"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/toaster";
import { CrmContactPanel } from "@/components/crm-contact-panel";
import { ApiError } from "@/lib/api/client";
import {
  fetchCrmContacts,
  fetchCrmOverview,
  updateContactBirthday,
  updateContactConsent,
} from "@/lib/api/crm";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { cn } from "@/lib/utils";
import type { GuestProfile } from "@/lib/types";

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function formatBirthday(month?: number | null, day?: number | null): string | null {
  if (!month) return null;
  return `${MONTHS_SHORT[month - 1]}${day ? ` ${day}` : ""}`;
}

function BirthdayCell({ guest }: { guest: GuestProfile }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<string>(guest.birthday_month ? String(guest.birthday_month) : "");
  const [day, setDay] = useState<string>(guest.birthday_day ? String(guest.birthday_day) : "");

  const save = useMutation({
    mutationFn: () =>
      updateContactBirthday(guest.id, {
        birthday_month: month ? Number(month) : null,
        birthday_day: day ? Number(day) : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contacts"], exact: false });
      qc.invalidateQueries({ queryKey: ["crm-overview"] });
      setOpen(false);
      toast.success("Birthday saved");
    },
    onError: (e) => toast.error("Could not save", e instanceof ApiError ? e.message : undefined),
  });

  const label = formatBirthday(guest.birthday_month, guest.birthday_day);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={
            label
              ? "rounded px-1.5 py-0.5 text-sm hover:bg-muted"
              : "rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          {label ?? "+ Add"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-2" align="center">
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Birthday month"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="">Month</option>
            {MONTHS_SHORT.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            aria-label="Birthday day"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          >
            <option value="">Day</option>
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function ContactsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const segment = params.get("segment") || "all";
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const timezone = useTenantTimezone();

  const debounced = useMemo(() => q.trim(), [q]);

  const overview = useQuery({
    queryKey: ["crm-overview"],
    queryFn: () => fetchCrmOverview().then((r) => r.data),
  });

  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["crm-contacts", segment, debounced],
    queryFn: () =>
      fetchCrmContacts({ segment, q: debounced || undefined, per_page: 50 }).then((r) => r.data),
  });

  const consent = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { whatsapp_consent?: boolean; email_consent?: boolean };
    }) => updateContactConsent(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-contacts"], exact: false });
      qc.invalidateQueries({ queryKey: ["crm-overview"] });
    },
    onError: (e) => toast.error("Could not update consent", e instanceof ApiError ? e.message : undefined),
  });

  const segments = overview.data?.segments ?? [];
  const rows: GuestProfile[] = list.data ?? [];

  // Derive the selected guest from the live list so consent/birthday edits made
  // in the table (or panel) flow straight into the open panel.
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  function setSegment(next: string) {
    const qs = next === "all" ? "" : `?segment=${next}`;
    router.replace(`/crm/contacts${qs}`);
  }

  return (
    <>
      <AppTopbar breadcrumbs={[{ label: "CRM" }, { label: "Contacts", current: true }]} />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              {segments.length === 0 ? (
                <SelectItem value="all">All contacts</SelectItem>
              ) : (
                segments.map((s) => (
                  <SelectItem key={s.key} value={s.key}>
                    {s.label} ({s.count})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Input
            className="max-w-sm"
            placeholder="Search name, email, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {list.isFetching && <span className="text-xs text-muted-foreground">Refreshing…</span>}
        </div>

        {list.isError && (
          <p className="text-sm text-destructive">
            {list.error instanceof ApiError ? list.error.message : "Failed to load contacts."}
          </p>
        )}

        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
        {list.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No contacts in this segment yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Phone</th>
                  <th className="px-4 py-2.5 text-right font-medium">Visits</th>
                  <th className="px-4 py-2.5 font-medium">Birthday</th>
                  <th className="px-4 py-2.5 text-center font-medium">WhatsApp</th>
                  <th className="px-4 py-2.5 text-center font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Last visit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    aria-selected={selectedId === c.id}
                    className={cn(
                      "cursor-pointer hover:bg-muted/30",
                      selectedId === c.id && "bg-muted/60",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <span className="flex items-center gap-2">
                        {c.name}
                        {(c.no_show_count ?? 0) >= 2 && (
                          <Badge variant="warning">No-show risk</Badge>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.email || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.visit_count ?? 0}</td>
                    {/* Interactive cells don't select the row. */}
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <BirthdayCell guest={c} />
                    </td>
                    <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={c.whatsapp_consent === true}
                        disabled={!c.phone || consent.isPending}
                        onCheckedChange={(v) =>
                          consent.mutate({ id: c.id, payload: { whatsapp_consent: v } })
                        }
                        aria-label="WhatsApp marketing consent"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={c.email_consent === true}
                        disabled={!c.email || consent.isPending}
                        onCheckedChange={(v) =>
                          consent.mutate({ id: c.id, payload: { email_consent: v } })
                        }
                        aria-label="Email marketing consent"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDate(c.last_visit_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
          </div>

          {/* Persistent detail panel on desktop, WhatsApp-inbox style. */}
          <aside className="sticky top-4 hidden max-h-[calc(100vh-8rem)] w-[340px] shrink-0 flex-col self-start overflow-hidden rounded-xl border border-border bg-card lg:flex">
            <div className="shrink-0 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Guest profile</h2>
              <p className="text-xs text-muted-foreground">CRM details for this contact</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <CrmContactPanel
                guest={selected}
                timezone={timezone}
                onToggleConsent={(id, payload) => consent.mutate({ id, payload })}
                consentPending={consent.isPending}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* On smaller screens the panel slides in from the right instead. */}
      <Sheet
        open={!isDesktop && !!selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      >
        <SheetContent side="right" className="w-full max-w-sm p-0">
          <SheetHeader className="border-b border-border px-4 py-3 text-left">
            <SheetTitle>Guest profile</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <CrmContactPanel
              guest={selected}
              timezone={timezone}
              onToggleConsent={(id, payload) => consent.mutate({ id, payload })}
              consentPending={consent.isPending}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function CrmContactsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ContactsInner />
    </Suspense>
  );
}
