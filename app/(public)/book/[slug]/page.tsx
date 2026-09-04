"use client";

import { useState, useMemo } from "react";
import { use } from "react";
import { Calendar, Check, ChevronLeft, ClipboardList, Clock, Minus, Plus, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TamuLogo } from "@/components/tamu-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { publicBookingApi } from "@/lib/api/public-booking";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { formatGuestAssignedTables, ordinal } from "@/lib/format";
import { PhoneInput } from "@/components/phone-input";
import { StepSection, StepTable } from "@/components/venue-map-booking-steps";
import { StepMenu } from "@/components/menu-booking-step";
import type {
  PublicAvailabilitySlot,
  PublicReservation,
  PublicTenant,
  SpaService,
  Therapist,
  MenuOrderLine,
} from "@/lib/types";

type Step = "service" | "date" | "slot" | "section" | "table" | "menu" | "details" | "done";

interface BookingState {
  service_id: string | null;
  therapist_id: string | null;
  date: string;
  party_size: number;
  slot: PublicAvailabilitySlot | null;
  section_id: string | null;
  section_name: string | null;
  table_id: string | null;
  /** Pre-ordered menu lines. Ids and quantities only — never prices. */
  menu_lines: MenuOrderLine[];
  guest: {
    name: string;
    email: string;
    phone: string;
    marketing_opt_in: boolean;
    birthday_month: number | null;
    birthday_day: number | null;
  };
  occasion: string;
  special_requests: string;
  custom_fields: Record<string, string>;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Local-timezone "YYYY-MM-DDTHH:mm" string suitable for a
 * `<input type="datetime-local" min=...>` attribute. Toisostring() would
 * shift the value into UTC and break the browser's "min" comparison.
 */
function nowLocalDatetime() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export default function PublicBookingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const profileQuery = useQuery({
    queryKey: ["public", slug, "profile"],
    queryFn: async () => (await publicBookingApi.profile(slug)).data,
    retry: false,
  });

  if (profileQuery.isLoading) {
    return <BookingShellSkeleton />;
  }

  if (profileQuery.isError) {
    const err = profileQuery.error;
    return (
      <BookingShell tenant={null}>
        <Card className="p-8 text-center">
          <h1 className="text-xl font-semibold">Booking page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {err instanceof ApiError && err.status === 404
              ? "This venue hasn't published their booking page yet."
              : "We couldn't load this booking page. Please try again later."}
          </p>
        </Card>
      </BookingShell>
    );
  }

  if (!profileQuery.data) {
    return <BookingShellSkeleton />;
  }

  return <PublicBookingFlow slug={slug} venue={profileQuery.data} />;
}

function PublicBookingFlow({
  slug,
  venue,
}: {
  slug: string;
  venue: PublicTenant;
}) {
  const venueIsSpa = venue.booking_strategy === "spa";
  // Map booking is restaurant-only and opt-in per venue. Everything below
  // falls back to the classic 4-step flow when it's off.
  const venueHasMap = !venueIsSpa && venue.venue_map?.enabled === true;
  // Driven by the venue's menu mode, so a venue with no menu — or one switched
  // off — never gets a Menu step, empty or otherwise.
  const venueHasMenu = !venueIsSpa && venue.menu?.visible === true;

  const [step, setStep] = useState<Step>(venueIsSpa ? "service" : "date");
  const [confirmation, setConfirmation] = useState<PublicReservation | null>(null);
  const [state, setState] = useState<BookingState>({
    service_id: null,
    therapist_id: null,
    date: todayISO(),
    party_size: 2,
    slot: null,
    section_id: null,
    section_name: null,
    table_id: null,
    menu_lines: [],
    guest: { name: "", email: "", phone: "", marketing_opt_in: false, birthday_month: null, birthday_day: null },
    occasion: "",
    special_requests: "",
    custom_fields: {},
  });

  return (
    <BookingShell tenant={venue} isSpa={venueIsSpa}>
      <Stepper
        step={step}
        isSpa={venueIsSpa}
        hasMap={venueHasMap}
        hasMenu={venueHasMenu}
        terminology={venue.terminology}
      />
      {step === "service" && venueIsSpa && (
        <StepService
          slug={slug}
          tenant={venue}
          state={state}
          setState={setState}
          onNext={() => setStep("date")}
        />
      )}
      {step === "date" && (
        <StepDate
          tenant={venue}
          state={state}
          setState={setState}
          onBack={venueIsSpa ? () => setStep("service") : undefined}
          onNext={() => setStep("slot")}
        />
      )}
      {step === "slot" && (
        <StepSlot
          slug={slug}
          tenant={venue}
          state={state}
          setState={setState}
          onBack={() => setStep("date")}
          onNext={() => setStep(venueHasMap ? "section" : venueHasMenu ? "menu" : "details")}
        />
      )}
      {step === "section" && venueHasMap && (
        <StepSection
          slug={slug}
          selectedId={state.section_id}
          onSelect={(section) => {
            // Changing area invalidates any spot chosen in the previous one.
            setState((s) => ({
              ...s,
              section_id: section.id,
              section_name: section.name,
              table_id: null,
            }));
            setStep("table");
          }}
          onBack={() => setStep("slot")}
        />
      )}
      {step === "table" && venueHasMap && state.section_id && state.slot && (
        <StepTable
          slug={slug}
          sectionId={state.section_id}
          sectionName={state.section_name ?? ""}
          reservedAt={state.slot.reserved_at_utc}
          partySize={state.party_size}
          selectedTableId={state.table_id}
          onSelect={(table) => setState((s) => ({ ...s, table_id: table?.id ?? null }))}
          onBack={() => {
            setState((s) => ({ ...s, table_id: null }));
            setStep("section");
          }}
          onNext={() => setStep(venueHasMenu ? "menu" : "details")}
        />
      )}

      {step === "menu" && venueHasMenu && (
        <StepMenu
          slug={slug}
          lines={state.menu_lines}
          onChange={(menu_lines) => setState((s) => ({ ...s, menu_lines }))}
          onBack={() => setStep(venueHasMap ? "table" : "slot")}
          onNext={() => setStep("details")}
        />
      )}

      {step === "details" && (
        <StepDetails
          slug={slug}
          tenant={venue}
          state={state}
          setState={setState}
          onBack={() =>
            setStep(venueHasMenu ? "menu" : venueHasMap ? "table" : "slot")
          }
          onSuccess={(r) => {
            setConfirmation(r);
            setStep("done");
          }}
        />
      )}
      {step === "done" && confirmation && (
        <StepDone confirmation={confirmation} tenant={venue} />
      )}
    </BookingShell>
  );
}

function BookingShell({
  tenant,
  isSpa,
  children,
}: {
  tenant: PublicTenant | null;
  isSpa?: boolean;
  children: React.ReactNode;
}) {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isStaffSession = hydrated && !!token;
  const staffBackHref = isSpa ? "/reservations" : "/live";

  return (
    <div className="mx-auto max-w-2xl p-4 pt-10 sm:p-8">
      <header className="mb-8">
        {isStaffSession ? (
          <Link
            href={staffBackHref}
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Back to app
          </Link>
        ) : null}
        {tenant && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight">
              {tenant.name}
            </h1>
            {tenant.description && (
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                {tenant.description}
              </p>
            )}
            {(tenant.address || tenant.phone) && (
              <p className="mt-3 text-xs text-muted-foreground">
                {tenant.address}
                {tenant.address && tenant.phone ? " · " : ""}
                {tenant.phone}
              </p>
            )}
          </>
        )}
      </header>

      {children}

      <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
        <TamuLogo height={12} className="opacity-70" />
        <span>Bookings powered by Tamu</span>
      </footer>
    </div>
  );
}

function BookingShellSkeleton() {
  return (
    <div className="mx-auto max-w-2xl p-4 pt-10 sm:p-8">
      <Skeleton className="mb-2 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-72" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

const RESTAURANT_STEPS: { id: Step; label: string }[] = [
  { id: "date", label: "Date & guests" },
  { id: "slot", label: "Time" },
  { id: "details", label: "Details" },
  { id: "done", label: "Done" },
];

/** Map venues insert the area + spot steps between time and details. */
const RESTAURANT_MAP_STEPS: { id: Step; label: string }[] = [
  { id: "date", label: "Date & guests" },
  { id: "slot", label: "Time" },
  { id: "section", label: "Area" },
  { id: "table", label: "Spot" },
  { id: "details", label: "Details" },
  { id: "done", label: "Done" },
];

/**
 * The Menu step only exists when the venue's menu mode says so — a venue with
 * no menu, or one switched off, must not get an empty step in its stepper.
 */
function withMenuStep(steps: { id: Step; label: string }[], hasMenu: boolean) {
  if (!hasMenu) return steps;
  const at = steps.findIndex((s) => s.id === "details");
  return [...steps.slice(0, at), { id: "menu" as Step, label: "Menu" }, ...steps.slice(at)];
}

const SPA_STEPS: { id: Step; label: string }[] = [
  { id: "service", label: "Treatment" },
  { id: "date", label: "Date" },
  { id: "slot", label: "Time" },
  { id: "details", label: "Details" },
  { id: "done", label: "Done" },
];

function Stepper({
  step,
  isSpa,
  hasMap,
  hasMenu,
  terminology,
}: {
  step: Step;
  isSpa?: boolean;
  hasMap?: boolean;
  hasMenu?: boolean;
  terminology?: PublicTenant["terminology"];
}) {
  const steps = isSpa
    ? SPA_STEPS
    : withMenuStep(hasMap ? RESTAURANT_MAP_STEPS : RESTAURANT_STEPS, !!hasMenu);
  const idx = steps.findIndex((s) => s.id === step);
  const partyLabel = terminology?.party ?? "Party size";

  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
              i < idx && "bg-emerald-100 text-emerald-700",
              i === idx && "bg-foreground text-primary-foreground",
              i > idx && "bg-muted text-muted-foreground",
            )}
          >
            {i < idx ? <Check className="h-3 w-3" /> : i + 1}
          </span>
          <span
            className={cn(
              "text-xs font-medium",
              i === idx ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {s.id === "date" && !isSpa ? partyLabel : s.label}
          </span>
          {i < steps.length - 1 && (
            <span className="ml-2 hidden flex-1 border-t border-dashed border-border sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function StepService({
  slug,
  tenant,
  state,
  setState,
  onNext,
}: {
  slug: string;
  tenant: PublicTenant;
  state: BookingState;
  setState: React.Dispatch<React.SetStateAction<BookingState>>;
  onNext: () => void;
}) {
  const catalogQuery = useQuery({
    queryKey: ["public", slug, "catalog"],
    queryFn: async () => (await publicBookingApi.catalog(slug)).data,
  });

  const services = catalogQuery.data?.services ?? [];
  const therapists = catalogQuery.data?.therapists ?? [];
  const intro = tenant.terminology?.book_intro ?? "Choose a treatment";
  const bookCta = tenant.terminology?.book_cta ?? "Continue";
  const resourceLabel = tenant.terminology?.resource ?? "Therapist";

  const eligibleTherapists = useMemo(() => {
    if (!state.service_id) return therapists;
    const service = services.find((s) => s.id === state.service_id);
    const ids = new Set(service?.therapist_ids ?? service?.therapists?.map((t) => t.id));
    return therapists.filter((t) => ids.size === 0 || ids.has(t.id));
  }, [state.service_id, services, therapists]);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{intro}</h2>
      <div className="mt-5 min-h-[120px]">
        {catalogQuery.isPending && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}
        {catalogQuery.isSuccess && services.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No treatments are available to book right now.
          </p>
        )}
        {catalogQuery.isSuccess && services.length > 0 && (
          <div className="space-y-2">
            {services.map((service: SpaService) => {
              const selected = state.service_id === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      service_id: service.id,
                      therapist_id: null,
                    }))
                  }
                  className={cn(
                    "flex w-full items-start justify-between rounded-lg border p-4 text-left transition-colors",
                    selected
                      ? "border-foreground bg-foreground/5"
                      : "border-border hover:bg-muted/40",
                  )}
                >
                  <div>
                    <div className="font-medium">{service.name}</div>
                    {service.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                  <div className="ml-4 shrink-0 text-right text-xs text-muted-foreground">
                    <div>{service.duration_mins} min</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {state.service_id && eligibleTherapists.length > 0 && (
        <div className="mt-6 space-y-2">
          <Label>
            {resourceLabel}{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, therapist_id: null }))}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                !state.therapist_id
                  ? "border-foreground bg-foreground text-primary-foreground"
                  : "border-border hover:bg-muted",
              )}
            >
              Any available
            </button>
            {eligibleTherapists.map((t: Therapist) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setState((s) => ({ ...s, therapist_id: t.id }))}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm",
                  state.therapist_id === t.id
                    ? "border-foreground bg-foreground text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!state.service_id}>
          {bookCta}
        </Button>
      </div>
    </Card>
  );
}

function StepDate({
  tenant,
  state,
  setState,
  onBack,
  onNext,
}: {
  tenant: PublicTenant;
  state: BookingState;
  setState: React.Dispatch<React.SetStateAction<BookingState>>;
  onBack?: () => void;
  onNext: () => void;
}) {
  const usesPartySize = tenant.uses_party_size !== false;
  const intro = tenant.terminology?.book_intro ?? (usesPartySize ? "When would you like to dine?" : "When would you like to visit?");
  const bookCta = tenant.terminology?.book_cta ?? (usesPartySize ? "Find a table" : "Continue");
  const partyLabel = tenant.terminology?.party ?? "Party size";
  const minDate = todayISO();
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{intro}</h2>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="b-date">
            <Calendar className="mr-1 inline h-3 w-3" /> Date
          </Label>
          <Input
            id="b-date"
            type="date"
            min={minDate}
            value={state.date}
            onChange={(e) => setState((s) => ({ ...s, date: e.target.value }))}
          />
        </div>
        {usesPartySize && (
          <div className="space-y-1.5">
            <Label htmlFor="b-party">
              <Users className="mr-1 inline h-3 w-3" /> {partyLabel}
            </Label>
            {/* 44px controls — this is a primary action on a phone-first guest flow. */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 shrink-0 p-0"
                aria-label={`Decrease ${partyLabel.toLowerCase()}`}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    party_size: Math.max(1, s.party_size - 1),
                  }))
                }
              >
                <Minus className="h-4 w-4" aria-hidden />
              </Button>
              <Input
                id="b-party"
                type="number"
                min={1}
                max={20}
                value={state.party_size}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    party_size: Math.max(1, Number(e.target.value) || 1),
                  }))
                }
                className="h-11 text-center"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 w-11 shrink-0 p-0"
                aria-label={`Increase ${partyLabel.toLowerCase()}`}
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    party_size: Math.min(20, s.party_size + 1),
                  }))
                }
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className={cn("mt-6 flex", onBack ? "justify-between" : "justify-end")}>
        {onBack ? (
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        ) : null}
        <Button
          onClick={onNext}
          disabled={!state.date || (usesPartySize && state.party_size < 1)}
        >
          {bookCta}
        </Button>
      </div>
    </Card>
  );
}

function JoinWaitlistPanel({
  slug,
  partySize,
  tenant,
}: {
  slug: string;
  partySize: number;
  tenant: PublicTenant;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [localSlot, setLocalSlot] = useState("");
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: async () => {
      if (!localSlot) {
        throw new Error("Pick a preferred start time.");
      }
      const reservedAt = new Date(localSlot);
      if (Number.isNaN(reservedAt.getTime())) {
        throw new Error("Invalid datetime.");
      }
      return (
        await publicBookingApi.joinWaitlist(slug, {
          reserved_at: reservedAt.toISOString(),
          party_size: partySize,
          notes: notes.trim() || undefined,
          guest: {
            name: name.trim(),
            email: email.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        })
      ).data;
    },
  });

  async function submit() {
    setDoneMsg(null);
    try {
      const row = await join.mutateAsync();
      const pos = typeof row.position === "number" ? row.position : 1;
      setDoneMsg(
        `You’re on the list — position ${pos}. We’ll notify you when a table opens.`,
      );
    } catch (e: unknown) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Something went wrong.";
      setDoneMsg(msg);
    }
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-start gap-2">
        <ClipboardList className="mt-0.5 h-4 w-4 text-amber-800" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Join the waitlist</p>
          <p className="text-xs text-amber-900/80">
            Fully booked times can still notify the kitchen you’re hoping to dine.
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wl-slot">Preferred start (your calendar)</Label>
          <Input
            id="wl-slot"
            type="datetime-local"
            value={localSlot}
            min={nowLocalDatetime()}
            onChange={(e) => setLocalSlot(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-name">Name</Label>
          <Input
            id="wl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-email">Email</Label>
          <Input
            id="wl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-phone">Phone</Label>
          <PhoneInput
            id="wl-phone"
            value={phone}
            onChange={setPhone}
            tenantTimezone={tenant.timezone}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="wl-notes">Notes (optional)</Label>
        <Input
          id="wl-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Celebration · seating preference · etc."
        />
      </div>
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={join.isPending || !name.trim() || (!email.trim() && !phone.trim())}
        onClick={() => void submit()}
      >
        {join.isPending ? "Submitting…" : "Submit waitlist request"}
      </Button>
      {doneMsg ? (
        <p
          className={cn(
            "text-xs",
            doneMsg.includes("on the list") ? "text-emerald-800" : "text-destructive",
          )}
        >
          {doneMsg}
        </p>
      ) : null}
    </div>
  );
}

function StepSlot({
  slug,
  tenant,
  state,
  setState,
  onBack,
  onNext,
}: {
  slug: string;
  tenant: PublicTenant;
  state: BookingState;
  setState: React.Dispatch<React.SetStateAction<BookingState>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const isSpa = tenant.booking_strategy === "spa";

  const availabilityQuery = useQuery({
    queryKey: isSpa
      ? ["public", slug, "availability", state.date, state.service_id, state.therapist_id]
      : ["public", slug, "availability", state.date, state.party_size],
    queryFn: async () => {
      if (isSpa && state.service_id) {
        return (
          await publicBookingApi.availability(slug, {
            date: state.date,
            service_id: state.service_id,
            therapist_id: state.therapist_id ?? undefined,
          })
        ).data;
      }
      return (
        await publicBookingApi.availability(slug, {
          date: state.date,
          party_size: state.party_size,
        })
      ).data;
    },
    enabled: isSpa ? !!state.service_id : true,
  });

  const slots = availabilityQuery.data?.slots ?? [];
  const grouped = useMemo(() => {
    const out = new Map<string, PublicAvailabilitySlot[]>();
    for (const slot of slots) {
      const list = out.get(slot.period) ?? [];
      list.push(slot);
      out.set(slot.period, list);
    }
    return out;
  }, [slots]);

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">
        Choose your time
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {state.date}
          {!isSpa && (
            <>
              {" "}
              · {state.party_size} {state.party_size === 1 ? "guest" : "guests"}
            </>
          )}
        </span>
      </h2>

      <div className="mt-5 min-h-[160px]">
        {availabilityQuery.isPending && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}
        {availabilityQuery.isError && (
          <p className="text-sm text-destructive">
            We couldn&apos;t load slots — please try again.
          </p>
        )}
        {availabilityQuery.isSuccess && slots.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-5 w-5 opacity-60" />
            <p className="font-medium text-foreground">No availability for this date{!isSpa ? "/party" : ""}.</p>
            <p className="mt-2">
              Try a different date{!isSpa ? " or fewer guests" : ""}.
            </p>
            {isSpa ? (
              <p className="mt-3 text-xs leading-relaxed">
                If this keeps happening, the venue may still be setting up — they need
                operating hours, at least one treatment room, an active service, and a
                therapist assigned to that service.
              </p>
            ) : (
              <p className="mt-3 text-xs leading-relaxed">
                If this keeps happening, the venue may still be setting up — they need
                operating hours and bookable tables that fit your party size.
              </p>
            )}
          </div>
        )}
        {availabilityQuery.isSuccess && slots.length === 0 && !isSpa && tenant.waitlist?.enabled && (
          <JoinWaitlistPanel slug={slug} partySize={state.party_size} tenant={tenant} />
        )}
        {availabilityQuery.isSuccess && slots.length > 0 && (
          <div className="space-y-5">
            {Array.from(grouped.entries()).map(([period, periodSlots]) => (
              <div key={period}>
                <p className="label-cap mb-2">{period}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {periodSlots.map((slot) => {
                    const selected =
                      state.slot?.reserved_at_utc === slot.reserved_at_utc;
                    return (
                      <button
                        key={slot.reserved_at_utc}
                        type="button"
                        onClick={() => setState((s) => ({ ...s, slot }))}
                        className={cn(
                          "h-10 rounded-md border text-sm font-medium transition-colors",
                          selected
                            ? "border-foreground bg-foreground text-primary-foreground"
                            : "border-border bg-background hover:bg-muted",
                        )}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!state.slot}>
          Continue
        </Button>
      </div>
    </Card>
  );
}

function StepDetails({
  slug,
  tenant,
  state,
  setState,
  onBack,
  onSuccess,
}: {
  slug: string;
  tenant: PublicTenant;
  state: BookingState;
  setState: React.Dispatch<React.SetStateAction<BookingState>>;
  onBack: () => void;
  onSuccess: (r: PublicReservation) => void;
}) {
  const isSpa = tenant.booking_strategy === "spa";
  const router = useRouter();

  const create = useMutation({
    mutationFn: () => {
      const customFields = Object.fromEntries(
        Object.entries(state.custom_fields).filter(([, v]) => v.trim() !== ""),
      );

      return publicBookingApi.create(slug, {
        reserved_at: state.slot!.reserved_at_utc,
        ...(isSpa
          ? {
              service_id: state.service_id ?? undefined,
              therapist_id: state.therapist_id ?? undefined,
            }
          : { party_size: state.party_size }),
        // Ignored server-side unless the venue has the venue_map feature.
        table_id: state.table_id ?? undefined,
        // Ids and quantities only — the server prices the order from its own
        // catalogue, so a price sent from here would be ignored anyway.
        menu_items: state.menu_lines.length > 0 ? state.menu_lines : undefined,
        guest: {
          name: state.guest.name,
          email: state.guest.email,
          phone: state.guest.phone || undefined,
          marketing_opt_in: state.guest.marketing_opt_in || undefined,
          birthday_month: state.guest.birthday_month ?? undefined,
          birthday_day: state.guest.birthday_day ?? undefined,
        },
        occasion: !isSpa && state.occasion ? state.occasion : undefined,
        special_requests: state.special_requests || undefined,
        custom_fields:
          Object.keys(customFields).length > 0 ? customFields : undefined,
      });
    },
  });

  const errs =
    (create.error instanceof ApiError && create.error.errors) || {};
  const formError =
    create.error instanceof ApiError && !create.error.errors
      ? create.error.message
      : null;

  async function handleSubmit() {
    try {
      const r = await create.mutateAsync();
      // Payment required → our own /pay page, not straight out to the gateway.
      // It itemises what's owed (a deposit and pre-ordered food land on one
      // invoice, so a bare total reads as an overcharge) and it is also where
      // Xendit returns the guest, so the whole payment round-trip stays branded.
      if (r.data.payment?.status === "pending" && r.data.payment.invoice_url) {
        router.push(`/pay/${encodeURIComponent(r.data.confirmation_code)}`);
        return;
      }
      onSuccess(r.data);
    } catch {
      // shown inline
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {tenant.booking_strategy === "spa" ? (
          <>Appointment at {state.slot?.time} on {state.date}.</>
        ) : (
          <>
            Booking for {state.party_size}{" "}
            {state.party_size === 1 ? "guest" : "guests"} at {state.slot?.time} on{" "}
            {state.date}.
          </>
        )}
      </p>

      <div className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="g-name">Full name</Label>
          <Input
            id="g-name"
            value={state.guest.name}
            onChange={(e) =>
              setState((s) => ({ ...s, guest: { ...s.guest, name: e.target.value } }))
            }
            invalid={!!errs["guest.name"]}
            required
          />
          {errs["guest.name"]?.[0] && (
            <p className="text-xs text-destructive">{errs["guest.name"][0]}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="g-email">Email</Label>
            <Input
              id="g-email"
              type="email"
              value={state.guest.email}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  guest: { ...s.guest, email: e.target.value },
                }))
              }
              invalid={!!errs["guest.email"]}
              required
            />
            {errs["guest.email"]?.[0] && (
              <p className="text-xs text-destructive">
                {errs["guest.email"][0]}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-phone">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <PhoneInput
              id="g-phone"
              value={state.guest.phone}
              onChange={(next) =>
                setState((s) => ({
                  ...s,
                  guest: { ...s.guest, phone: next },
                }))
              }
              tenantTimezone={tenant.timezone}
              invalid={!!errs["guest.phone"]}
            />
            {errs["guest.phone"]?.[0] && (
              <p className="text-xs text-destructive">{errs["guest.phone"][0]}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Birthday <span className="text-muted-foreground">(optional)</span>
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <select
              aria-label="Birthday month"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              value={state.guest.birthday_month ?? ""}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  guest: {
                    ...s.guest,
                    birthday_month: e.target.value ? Number(e.target.value) : null,
                  },
                }))
              }
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Birthday day"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
              value={state.guest.birthday_day ?? ""}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  guest: {
                    ...s.guest,
                    birthday_day: e.target.value ? Number(e.target.value) : null,
                  },
                }))
              }
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">We&rsquo;ll send you a little something on your day.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
          <Checkbox
            checked={state.guest.marketing_opt_in}
            onCheckedChange={(v) =>
              setState((s) => ({
                ...s,
                guest: { ...s.guest, marketing_opt_in: v === true },
              }))
            }
            className="mt-0.5"
          />
          <span className="text-sm text-muted-foreground">
            Keep me updated with offers and news from {tenant.name} via WhatsApp and email.
          </span>
        </label>

        {(tenant.custom_booking_fields ?? []).map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`cf-${field.key}`}>
              {field.label}
              {field.required ? null : (
                <span className="text-muted-foreground"> (optional)</span>
              )}
            </Label>
            {field.type === "select" ? (
              <select
                id={`cf-${field.key}`}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                value={state.custom_fields[field.key] ?? ""}
                required={field.required}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    custom_fields: {
                      ...s.custom_fields,
                      [field.key]: e.target.value,
                    },
                  }))
                }
              >
                <option value="">Choose…</option>
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id={`cf-${field.key}`}
                value={state.custom_fields[field.key] ?? ""}
                required={field.required}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    custom_fields: {
                      ...s.custom_fields,
                      [field.key]: e.target.value,
                    },
                  }))
                }
              />
            )}
          </div>
        ))}

        {!isSpa && (
          <div className="space-y-1.5">
            <Label htmlFor="g-occ">
              Special occasion{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="g-occ"
              value={state.occasion}
              onChange={(e) =>
                setState((s) => ({ ...s, occasion: e.target.value }))
              }
              placeholder="Birthday, anniversary…"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="g-req">
            Special requests{" "}
            <span className="text-muted-foreground">
              {isSpa
                ? "(symptoms, pains you're struggling with, etc.)"
                : "(optional)"}
            </span>
          </Label>
          <textarea
            id="g-req"
            rows={3}
            maxLength={1000}
            value={state.special_requests}
            onChange={(e) =>
              setState((s) => ({ ...s, special_requests: e.target.value }))
            }
            placeholder={
              isSpa
                ? "e.g. lower back pain, shoulder tension, areas to avoid…"
                : undefined
            }
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {formError && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </p>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={create.isPending}>
          {create.isPending ? "Booking…" : "Confirm booking"}
        </Button>
      </div>
    </Card>
  );
}

function StepDone({
  confirmation,
  tenant,
}: {
  confirmation: PublicReservation;
  tenant: PublicTenant | null;
}) {
  const tz = tenant?.timezone ?? confirmation.restaurant_timezone ?? "UTC";
  // Backend returns total_bookings AFTER the current booking has been
  // incremented, so total > 1 ⇒ this guest has dined before.
  const totalBookings = confirmation.guest?.total_bookings ?? 0;
  const isReturning = totalBookings > 1;
  const isSpa = !!confirmation.service;
  const reservationLabel = tenant?.terminology?.reservation?.toLowerCase() ?? "booking";
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">
        {isReturning
          ? `Welcome back${confirmation.guest?.name ? `, ${confirmation.guest.name.split(" ")[0]}` : ""}`
          : confirmation.status === "confirmed"
            ? `Your ${reservationLabel} is confirmed`
            : `We've received your ${reservationLabel}`}
      </h2>
      {isReturning && (
        <p className="mt-1 text-sm font-medium text-foreground">
          This is your <span className="tabular-nums">{ordinal(totalBookings)}</span>{" "}
          booking with {tenant?.name ?? "us"} — thank you for coming back.
        </p>
      )}
      <p className={cn("text-sm text-muted-foreground", isReturning ? "mt-1" : "mt-1")}>
        {tenant?.name ?? "The venue"} will see you on{" "}
        {new Intl.DateTimeFormat(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        }).format(new Date(confirmation.reserved_at))}
        .
      </p>

      {(confirmation.service || confirmation.therapist) && (
        <div className="mx-auto mt-4 max-w-md rounded-xl border border-border bg-card px-6 py-4 text-left shadow-xs">
          <span className="label-cap">Your appointment</span>
          {confirmation.service && (
            <p className="mt-1.5 text-sm font-medium text-foreground">
              {confirmation.service.name}
              <span className="ml-2 text-muted-foreground">
                · {confirmation.service.duration_mins} min
              </span>
            </p>
          )}
          {confirmation.therapist && (
            <p className="mt-1 text-sm text-muted-foreground">
              with {confirmation.therapist.name}
            </p>
          )}
        </div>
      )}

      <div className="mx-auto mt-6 inline-flex flex-col rounded-xl border border-border bg-muted/40 px-6 py-4">
        <span className="label-cap">Confirmation code</span>
        <span className="mt-1 font-mono text-2xl font-semibold tracking-[0.12em]">
          {confirmation.confirmation_code}
        </span>
      </div>

      {!isSpa && formatGuestAssignedTables(confirmation.assigned_tables) && (
        <div className="mx-auto mt-4 max-w-md rounded-xl border border-border bg-card px-6 py-4 text-left shadow-xs">
          <span className="label-cap">Your table</span>
          <p className="mt-1.5 text-sm font-medium text-foreground">
            {formatGuestAssignedTables(confirmation.assigned_tables)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            The venue may change this before you arrive — check your email or manage
            your booking if anything shifts.
          </p>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        We&apos;ve emailed you a copy with this code. Use it to view or cancel
        your booking later.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={`/manage/${confirmation.confirmation_code}`}
          className="inline-flex h-9 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-primary-foreground"
        >
          Manage booking
        </Link>
      </div>
    </Card>
  );
}
