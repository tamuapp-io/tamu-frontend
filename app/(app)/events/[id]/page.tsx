"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChartLine, ExternalLink, Mail, Phone, Plus, Search, Trash2, Upload } from "lucide-react";
import { eventsApi } from "@/lib/api/events";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  useCreateReferral,
  useEvent,
  useEventBuyers,
  useEventLifecycle,
  useEventReferrals,
  useTicketTypeMutations,
  useUpdateEvent,
} from "@/lib/hooks/use-events";
import { formatDate, formatMoney } from "@/lib/format";
import type {
  EventModel,
  EventPageBlock,
  EventPageConfig,
  TicketOrder,
  TicketType,
} from "@/lib/types";

/** ISO → value for <input type="datetime-local"> in the browser's local tz. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  completed: "bg-amber-100 text-amber-900",
};

export default function EventEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const event = useEvent(id);
  const lifecycle = useEventLifecycle(id);
  const tenant = useAuthStore((s) => s.tenant);

  if (event.isPending) {
    return (
      <>
        <AppTopbar breadcrumbs={[{ label: "Events" }, { label: "Loading…", current: true }]} />
        <div className="space-y-3 p-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  if (event.isError || !event.data) {
    return (
      <>
        <AppTopbar breadcrumbs={[{ label: "Events" }, { label: "Error", current: true }]} />
        <p className="p-6 text-sm text-destructive">
          {event.error instanceof ApiError ? event.error.message : "Failed to load event."}
        </p>
      </>
    );
  }

  const data = event.data;
  const publicHref =
    tenant?.slug ? `/book/${tenant.slug}/events/${data.slug}` : null;

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Events" },
          { label: data.name, current: true },
        ]}
      />
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-semibold">{data.name}</h1>
              <Badge className={STATUS_TONE[data.status]}>{data.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">/{data.slug}</p>
          </div>

          <Link
            href={`/events/${id}/analytics`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
          >
            <ChartLine className="h-4 w-4" /> Analytics
          </Link>
          {publicHref && (
            <a
              href={publicHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              <ExternalLink className="h-4 w-4" /> View page
            </a>
          )}
          {data.status === "published" ? (
            <Button
              variant="outline"
              disabled={lifecycle.unpublish.isPending}
              onClick={() => lifecycle.unpublish.mutate()}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              disabled={lifecycle.publish.isPending}
              onClick={() => lifecycle.publish.mutate()}
            >
              Publish
            </Button>
          )}
        </div>

        {lifecycle.publish.error instanceof ApiError && (
          <p className="text-sm text-destructive">{lifecycle.publish.error.message}</p>
        )}

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="tickets">Ticket types</TabsTrigger>
            <TabsTrigger value="buyers">Buyers</TabsTrigger>
            <TabsTrigger value="page">Page</TabsTrigger>
            <TabsTrigger value="referrals">Referrals</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <DetailsTab event={data} />
          </TabsContent>
          <TabsContent value="tickets">
            <TicketTypesTab event={data} />
          </TabsContent>
          <TabsContent value="buyers">
            <BuyersTab eventId={id} />
          </TabsContent>
          <TabsContent value="page">
            <PageBuilderTab event={data} />
          </TabsContent>
          <TabsContent value="referrals">
            <ReferralsTab eventId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  Details                                                                   */
/* -------------------------------------------------------------------------- */

function DetailsTab({ event }: { event: EventModel }) {
  const update = useUpdateEvent(event.id);
  const [name, setName] = useState(event.name);
  const [venue, setVenue] = useState(event.venue ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [startsAt, setStartsAt] = useState(isoToLocalInput(event.starts_at));
  const [endsAt, setEndsAt] = useState(isoToLocalInput(event.ends_at));
  const [scanStartsAt, setScanStartsAt] = useState(isoToLocalInput(event.scan_starts_at ?? null));
  const [scanEndsAt, setScanEndsAt] = useState(isoToLocalInput(event.scan_ends_at ?? null));
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    await update.mutateAsync({
      name: name.trim(),
      venue: venue.trim() || null,
      description: description.trim() || null,
      starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      scan_starts_at: scanStartsAt ? new Date(scanStartsAt).toISOString() : null,
      scan_ends_at: scanEndsAt ? new Date(scanEndsAt).toISOString() : null,
    });
    setSaved(true);
  }

  return (
    <div className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1.5">
        <Label htmlFor="d-name">Name</Label>
        <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="d-start">Starts at</Label>
          <Input
            id="d-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="d-end">Ends at (optional)</Label>
          <Input
            id="d-end"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-venue">Venue</Label>
        <Input id="d-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium">Check-in window</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tickets can only be scanned between these times. Leave both empty to
          allow scanning anytime (until the event is cancelled).
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="d-scan-start">Scan opens</Label>
            <Input
              id="d-scan-start"
              type="datetime-local"
              value={scanStartsAt}
              onChange={(e) => setScanStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-scan-end">Scan closes</Label>
            <Input
              id="d-scan-end"
              type="datetime-local"
              value={scanEndsAt}
              onChange={(e) => setScanEndsAt(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-desc">Description</Label>
        <textarea
          id="d-desc"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
        {saved && !update.isPending && (
          <span className="text-xs text-emerald-700">Saved</span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ticket types                                                              */
/* -------------------------------------------------------------------------- */

function TicketTypesTab({ event }: { event: EventModel }) {
  const mutations = useTicketTypeMutations(event.id);
  const [adding, setAdding] = useState(false);
  const types = event.ticket_types ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="md" variant="outline" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-4 w-4" /> Add ticket type
        </Button>
      </div>

      {adding && (
        <TicketTypeForm
          onCancel={() => setAdding(false)}
          submitting={mutations.create.isPending}
          error={mutations.create.error}
          onSubmit={async (payload) => {
            await mutations.create.mutateAsync(payload);
            setAdding(false);
          }}
        />
      )}

      {types.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No ticket variations yet. Add General, VIP, Early Bird, etc.
        </p>
      )}

      <div className="grid gap-3">
        {types.map((type) => (
          <TicketTypeRow key={type.id} type={type} mutations={mutations} />
        ))}
      </div>
    </div>
  );
}

function TicketTypeRow({
  type,
  mutations,
}: {
  type: TicketType;
  mutations: ReturnType<typeof useTicketTypeMutations>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <TicketTypeForm
        initial={type}
        submitting={mutations.update.isPending}
        error={mutations.update.error}
        onCancel={() => setEditing(false)}
        onSubmit={async (payload) => {
          await mutations.update.mutateAsync({ id: type.id, payload });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{type.name}</h4>
          {!type.is_active && <Badge variant="muted">inactive</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {type.price_cents === 0 ? "Free" : formatMoney(type.price_cents, type.currency)}
          {" · "}
          {type.quantity_total === null
            ? "Unlimited"
            : `${type.quantity_sold}/${type.quantity_total} sold`}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Delete ticket type"
        disabled={mutations.remove.isPending}
        onClick={() => {
          if (confirm(`Delete "${type.name}"?`)) mutations.remove.mutate(type.id);
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function TicketTypeForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  initial?: TicketType;
  onSubmit: (payload: {
    name: string;
    price_cents: number;
    currency: string;
    quantity_total: number | null;
    min_per_order: number;
    max_per_order: number;
    is_active: boolean;
  }) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  error: unknown;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(String((initial?.price_cents ?? 0) / 100));
  const [currency, setCurrency] = useState(initial?.currency ?? "IDR");
  const [unlimited, setUnlimited] = useState(initial ? initial.quantity_total === null : false);
  const [quantity, setQuantity] = useState(String(initial?.quantity_total ?? 100));
  const [minPer, setMinPer] = useState(String(initial?.min_per_order ?? 1));
  const [maxPer, setMaxPer] = useState(String(initial?.max_per_order ?? 5));
  const [active, setActive] = useState(initial?.is_active ?? true);

  const errs = (error instanceof ApiError && error.errors) || {};
  const formError = error instanceof ApiError && !error.errors ? error.message : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="General Admission" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <Label>Price</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Currency</Label>
            <Input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Quantity</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={unlimited ? "" : quantity}
              disabled={unlimited}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
            Unlimited
          </label>
        </div>
        <div className="space-y-1.5">
          <Label>Min / order</Label>
          <Input type="number" min={1} value={minPer} onChange={(e) => setMinPer(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Max / order</Label>
          <Input type="number" min={1} value={maxPer} onChange={(e) => setMaxPer(e.target.value)} />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active (available for sale)
      </label>

      {errs.name?.[0] && <p className="text-xs text-destructive">{errs.name[0]}</p>}
      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <div className="flex gap-2">
        <Button
          disabled={submitting || !name.trim()}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              price_cents: Math.round((Number(price) || 0) * 100),
              currency: currency || "IDR",
              quantity_total: unlimited ? null : Math.max(0, Number(quantity) || 0),
              min_per_order: Math.max(1, Number(minPer) || 1),
              max_per_order: Math.max(1, Number(maxPer) || 1),
              is_active: active,
            })
          }
        >
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Buyers                                                                    */
/* -------------------------------------------------------------------------- */

const ORDER_STATUS_TONE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-900",
  cancelled: "bg-rose-100 text-rose-800",
  refunded: "bg-muted text-muted-foreground",
};

function BuyersTab({ eventId }: { eventId: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const buyers = useEventBuyers(eventId, {
    q: q.trim() || undefined,
    status: status || undefined,
  });

  const rows = buyers.data?.data ?? [];
  const total = buyers.data?.meta?.total ?? rows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name, email or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
        >
          <option value="">All statuses</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        {buyers.isFetching && (
          <span className="text-xs text-muted-foreground">Refreshing…</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {total} {total === 1 ? "buyer" : "buyers"}
        </span>
      </div>

      {buyers.isPending && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}
      {buyers.isError && (
        <p className="text-sm text-destructive">
          {buyers.error instanceof ApiError ? buyers.error.message : "Failed to load buyers."}
        </p>
      )}
      {!buyers.isPending && rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No ticket buyers yet.
        </p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Buyer</th>
                <th className="px-4 py-2.5 font-medium tabular-nums">Tickets</th>
                <th className="px-4 py-2.5 font-medium tabular-nums">Checked in</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium tabular-nums">Total</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Purchased</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <BuyerRow key={order.id} order={order} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BuyerRow({ order }: { order: TicketOrder }) {
  const guest = order.guest;
  const source = order.referral?.label ?? order.referral?.code ?? order.source ?? "Direct";

  return (
    <tr className="border-b border-border/60 last:border-0 align-top">
      <td className="px-4 py-3">
        <p className="font-medium">{guest?.name ?? "Guest"}</p>
        <div className="mt-0.5 flex flex-col gap-0.5 text-xs text-muted-foreground">
          {guest?.email && (
            <a
              href={`mailto:${guest.email}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Mail className="h-3 w-3" /> {guest.email}
            </a>
          )}
          {guest?.phone && (
            <a
              href={`tel:${guest.phone}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Phone className="h-3 w-3" /> {guest.phone}
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3 tabular-nums">{order.tickets_count ?? 0}</td>
      <td className="px-4 py-3 tabular-nums">
        {order.checked_in_count ?? 0}
        <span className="text-muted-foreground">/{order.tickets_count ?? 0}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs">{source}</span>
      </td>
      <td className="px-4 py-3 tabular-nums">
        {order.total_cents === 0 ? "Free" : formatMoney(order.total_cents, order.currency)}
      </td>
      <td className="px-4 py-3">
        <Badge className={ORDER_STATUS_TONE[order.status] ?? "bg-muted text-muted-foreground"}>
          {order.status}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {order.created_at ? formatDate(order.created_at) : "—"}
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/*  Image upload                                                              */
/* -------------------------------------------------------------------------- */

function ImageUploadField({
  value,
  folder,
  onChange,
}: {
  value: string;
  folder: "events/covers" | "events/blocks";
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await eventsApi.uploadImage(file, folder);
      onChange(res.data.url);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          placeholder="https://… or upload an image"
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="md"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            "Uploading…"
          ) : (
            <>
              <Upload className="h-4 w-4" /> Upload
            </>
          )}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {value && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value}
          alt=""
          className="h-24 w-full max-w-xs rounded-md border border-border object-cover"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page builder                                                              */
/* -------------------------------------------------------------------------- */

function PageBuilderTab({ event }: { event: EventModel }) {
  const update = useUpdateEvent(event.id);
  const [config, setConfig] = useState<EventPageConfig>(event.page_config ?? {});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(event.page_config ?? {});
  }, [event.page_config]);

  const blocks = config.blocks ?? [];

  function patchBlock(index: number, patch: Partial<EventPageBlock>) {
    setConfig((c) => {
      const next = [...(c.blocks ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...c, blocks: next };
    });
  }

  function addBlock(type: EventPageBlock["type"]) {
    setConfig((c) => ({ ...c, blocks: [...(c.blocks ?? []), { type }] }));
  }

  function removeBlock(index: number) {
    setConfig((c) => ({ ...c, blocks: (c.blocks ?? []).filter((_, i) => i !== index) }));
  }

  function moveBlock(index: number, dir: -1 | 1) {
    setConfig((c) => {
      const arr = [...(c.blocks ?? [])];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return c;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return { ...c, blocks: arr };
    });
  }

  async function save() {
    setSaved(false);
    await update.mutateAsync({ page_config: config });
    setSaved(true);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold">Theme</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Primary color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.theme?.primary ?? "#0f172a"}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, theme: { ...c.theme, primary: e.target.value } }))
                  }
                  className="h-9 w-12 rounded-md border border-input"
                />
                <Input
                  value={config.theme?.primary ?? ""}
                  placeholder="#0f172a"
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, theme: { ...c.theme, primary: e.target.value } }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <ImageUploadField
                value={config.theme?.cover_image_url ?? ""}
                folder="events/covers"
                onChange={(url) =>
                  setConfig((c) => ({
                    ...c,
                    theme: { ...c.theme, cover_image_url: url },
                  }))
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {blocks.map((block, i) => (
            <BlockEditor
              key={i}
              block={block}
              onChange={(patch) => patchBlock(i, patch)}
              onRemove={() => removeBlock(i)}
              onMoveUp={() => moveBlock(i, -1)}
              onMoveDown={() => moveBlock(i, 1)}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => addBlock("hero")}>
            + Hero
          </Button>
          <Button variant="outline" size="sm" onClick={() => addBlock("text")}>
            + Text
          </Button>
          <Button variant="outline" size="sm" onClick={() => addBlock("highlights")}>
            + Highlights
          </Button>
          <Button variant="outline" size="sm" onClick={() => addBlock("image")}>
            + Image
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save page"}
          </Button>
          {saved && !update.isPending && (
            <span className="text-xs text-emerald-700">Saved</span>
          )}
        </div>
      </div>

      <aside className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Live page</p>
        <p className="mt-1">
          Blocks render top-to-bottom on the public event page. Use Hero for the
          headline, Highlights for what&apos;s included, and Text for fine print.
        </p>
      </aside>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  block: EventPageBlock;
  onChange: (patch: Partial<EventPageBlock>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Badge variant="muted">{block.type}</Badge>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Move up" onClick={onMoveUp}>
            ↑
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Move down" onClick={onMoveDown}>
            ↓
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Remove block" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(block.type === "hero" || block.type === "text") && (
        <>
          <Input
            value={block.heading ?? ""}
            placeholder={block.type === "hero" ? "Hero heading" : "Section heading"}
            onChange={(e) => onChange({ heading: e.target.value })}
          />
          <textarea
            rows={3}
            value={block.body ?? ""}
            placeholder="Body text"
            onChange={(e) => onChange({ body: e.target.value })}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </>
      )}

      {block.type === "image" && (
        <ImageUploadField
          value={block.image_url ?? ""}
          folder="events/blocks"
          onChange={(url) => onChange({ image_url: url })}
        />
      )}

      {block.type === "highlights" && (
        <textarea
          rows={4}
          value={(block.items ?? []).join("\n")}
          placeholder="One highlight per line"
          onChange={(e) =>
            onChange({ items: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })
          }
          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Referrals                                                                 */
/* -------------------------------------------------------------------------- */

function ReferralsTab({ eventId }: { eventId: string }) {
  const referrals = useEventReferrals(eventId);
  const create = useCreateReferral(eventId);
  const [label, setLabel] = useState("");
  const [owner, setOwner] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const rows = referrals.data ?? [];

  async function add() {
    if (!label.trim()) return;
    await create.mutateAsync({ label: label.trim(), owner_name: owner.trim() || undefined });
    setLabel("");
    setOwner("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Instagram" />
        </div>
        <div className="space-y-1.5">
          <Label>Owner (optional)</Label>
          <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="@partner" />
        </div>
        <Button onClick={add} disabled={create.isPending || !label.trim()}>
          {create.isPending ? "Creating…" : "Create link"}
        </Button>
      </div>

      {referrals.isPending && <Skeleton className="h-24 w-full" />}

      {rows.length === 0 && !referrals.isPending && (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No referral links yet. Create one to track a channel&apos;s clicks and sales.
        </p>
      )}

      <div className="grid gap-3">
        {rows.map((ref) => (
          <div
            key={ref.id}
            className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{ref.label ?? ref.code}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {ref.share_url ?? `?ref=${ref.code}`}
              </p>
            </div>
            <div className="flex items-center gap-5 text-center text-xs">
              <Metric label="Clicks" value={ref.clicks} />
              <Metric label="Orders" value={ref.orders_count} />
            </div>
            {ref.share_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(ref.share_url as string);
                  setCopied(ref.id);
                  setTimeout(() => setCopied(null), 1500);
                }}
              >
                {copied === ref.id ? "Copied" : "Copy link"}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
