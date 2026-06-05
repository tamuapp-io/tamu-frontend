"use client";

import { useState, useMemo } from "react";
import { use } from "react";
import { Calendar, Check, ChevronLeft, ClipboardList, Clock, Users } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { TamuLogo } from "@/components/tamu-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { publicBookingApi } from "@/lib/api/public-booking";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";
import { formatGuestAssignedTables, ordinal } from "@/lib/format";
import { PhoneInput } from "@/components/phone-input";
import type {
  PublicAvailabilitySlot,
  PublicReservation,
  PublicTenant,
} from "@/lib/types";

type Step = "date" | "slot" | "details" | "done";

interface BookingState {
  date: string;
  party_size: number;
  slot: PublicAvailabilitySlot | null;
  guest: { name: string; email: string; phone: string };
  occasion: string;
  special_requests: string;
  custom_fields: Record<string, string>;
}

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
  const [step, setStep] = useState<Step>("date");
  const [confirmation, setConfirmation] = useState<PublicReservation | null>(null);
  const [state, setState] = useState<BookingState>({
    date: todayISO(),
    party_size: 2,
    slot: null,
    guest: { name: "", email: "", phone: "" },
    occasion: "",
    special_requests: "",
    custom_fields: {},
  });

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
              ? "This restaurant hasn't published their booking page yet."
              : "We couldn't load this booking page. Please try again later."}
          </p>
        </Card>
      </BookingShell>
    );
  }

  if (!profileQuery.data) {
    return <BookingShellSkeleton />;
  }

  const tenant = profileQuery.data;

  return (
    <BookingShell tenant={tenant}>
      <Stepper step={step} />
      {step === "date" && (
        <StepDate
          state={state}
          setState={setState}
          onNext={() => setStep("slot")}
        />
      )}
      {step === "slot" && (
        <StepSlot
          slug={slug}
          tenant={tenant}
          state={state}
          setState={setState}
          onBack={() => setStep("date")}
          onNext={() => setStep("details")}
        />
      )}
      {step === "details" && (
        <StepDetails
          slug={slug}
          tenant={tenant}
          state={state}
          setState={setState}
          onBack={() => setStep("slot")}
          onSuccess={(r) => {
            setConfirmation(r);
            setStep("done");
          }}
        />
      )}
      {step === "done" && confirmation && (
        <StepDone confirmation={confirmation} tenant={tenant} />
      )}
    </BookingShell>
  );
}

function BookingShell({
  tenant,
  children,
}: {
  tenant: PublicTenant | null;
  children: React.ReactNode;
}) {
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);
  const isStaffSession = hydrated && !!token;

  return (
    <div className="mx-auto max-w-2xl p-4 pt-10 sm:p-8">
      <header className="mb-8">
        {isStaffSession ? (
          <Link
            href="/live"
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

const STEPS: { id: Step; label: string }[] = [
  { id: "date", label: "Date & guests" },
  { id: "slot", label: "Time" },
  { id: "details", label: "Details" },
  { id: "done", label: "Done" },
];

function Stepper({ step }: { step: Step }) {
  const idx = STEPS.findIndex((s) => s.id === step);

  return (
    <ol className="mb-6 flex items-center gap-2">
      {STEPS.map((s, i) => (
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
            {s.label}
          </span>
          {i < STEPS.length - 1 && (
            <span className="ml-2 hidden flex-1 border-t border-dashed border-border sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

function StepDate({
  state,
  setState,
  onNext,
}: {
  state: BookingState;
  setState: React.Dispatch<React.SetStateAction<BookingState>>;
  onNext: () => void;
}) {
  const minDate = todayISO();
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">When would you like to dine?</h2>
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
        <div className="space-y-1.5">
          <Label htmlFor="b-party">
            <Users className="mr-1 inline h-3 w-3" /> Party size
          </Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  party_size: Math.max(1, s.party_size - 1),
                }))
              }
            >
              −
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
              className="text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  party_size: Math.min(20, s.party_size + 1),
                }))
              }
            >
              +
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={onNext} disabled={!state.date || state.party_size < 1}>
          Find a table
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
  const availabilityQuery = useQuery({
    queryKey: ["public", slug, "availability", state.date, state.party_size],
    queryFn: async () =>
      (
        await publicBookingApi.availability(slug, {
          date: state.date,
          party_size: state.party_size,
        })
      ).data,
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
          {state.date} · {state.party_size}{" "}
          {state.party_size === 1 ? "guest" : "guests"}
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
            No availability for this date/party.
            <br />
            Try a different date or fewer guests.
          </div>
        )}
        {availabilityQuery.isSuccess && slots.length === 0 && tenant.waitlist?.enabled && (
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
  const create = useMutation({
    mutationFn: () => {
      const customFields = Object.fromEntries(
        Object.entries(state.custom_fields).filter(([, v]) => v.trim() !== ""),
      );

      return publicBookingApi.create(slug, {
        reserved_at: state.slot!.reserved_at_utc,
        party_size: state.party_size,
        guest: {
          name: state.guest.name,
          email: state.guest.email,
          phone: state.guest.phone || undefined,
        },
        occasion: state.occasion || undefined,
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
      onSuccess(r.data);
    } catch {
      // shown inline
    }
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Your details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Booking for {state.party_size}{" "}
        {state.party_size === 1 ? "guest" : "guests"} at {state.slot?.time} on{" "}
        {state.date}.
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

        <div className="space-y-1.5">
          <Label htmlFor="g-req">
            Special requests{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <textarea
            id="g-req"
            rows={3}
            maxLength={1000}
            value={state.special_requests}
            onChange={(e) =>
              setState((s) => ({ ...s, special_requests: e.target.value }))
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
  return (
    <Card className="p-8 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
        <Check className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">
        {isReturning
          ? `Welcome back${confirmation.guest?.name ? `, ${confirmation.guest.name.split(" ")[0]}` : ""}`
          : confirmation.status === "confirmed"
            ? "Your booking is confirmed"
            : "We've received your booking"}
      </h2>
      {isReturning && (
        <p className="mt-1 text-sm font-medium text-foreground">
          This is your <span className="tabular-nums">{ordinal(totalBookings)}</span>{" "}
          booking with {tenant?.name ?? "us"} — thank you for coming back.
        </p>
      )}
      <p className={cn("text-sm text-muted-foreground", isReturning ? "mt-1" : "mt-1")}>
        {tenant?.name ?? "The restaurant"} will see you on{" "}
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

      <div className="mx-auto mt-6 inline-flex flex-col rounded-xl border border-border bg-muted/40 px-6 py-4">
        <span className="label-cap">Confirmation code</span>
        <span className="mt-1 font-mono text-2xl font-semibold tracking-[0.12em]">
          {confirmation.confirmation_code}
        </span>
      </div>

      {formatGuestAssignedTables(confirmation.assigned_tables) && (
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
