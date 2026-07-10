"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { KpiStat } from "@/components/kpi-stat";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreateService,
  useDeleteService,
  useServicesList,
  useTherapistsList,
  useUpdateService,
} from "@/lib/hooks/use-spa-catalog";
import { useCategory } from "@/lib/hooks/use-category";
import type { SpaService } from "@/lib/types";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "IDR",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function ServicesPage() {
  const { term } = useCategory();
  const { data: services = [], isPending } = useServicesList();
  const { data: therapists = [] } = useTherapistsList();
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SpaService | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration_mins: 60,
    price_cents: 0,
    currency: "IDR",
    is_active: true,
    therapist_ids: [] as string[],
  });

  const stats = useMemo(() => {
    const active = services.filter((s) => s.is_active);
    return { total: services.length, active: active.length };
  }, [services]);

  const filtered = useMemo(() => {
    if (!search.trim()) return services;
    const q = search.trim().toLowerCase();
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q),
    );
  }, [services, search]);

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      description: "",
      duration_mins: 60,
      price_cents: 0,
      currency: "IDR",
      is_active: true,
      therapist_ids: [],
    });
    setOpen(true);
  }

  function openEdit(service: SpaService) {
    setEditing(service);
    setForm({
      name: service.name,
      description: service.description ?? "",
      duration_mins: service.duration_mins,
      price_cents: service.price_cents,
      currency: service.currency,
      is_active: service.is_active,
      therapist_ids: service.therapist_ids ?? service.therapists?.map((t) => t.id) ?? [],
    });
    setOpen(true);
  }

  async function handleSave() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      duration_mins: form.duration_mins,
      price_cents: form.price_cents,
      currency: form.currency,
      is_active: form.is_active,
      therapist_ids: form.therapist_ids,
    };
    try {
      if (editing) {
        await updateService.mutateAsync({ id: editing.id, payload });
        toast.success("Service updated", editing.name);
      } else {
        await createService.mutateAsync(payload);
        toast.success("Service created", payload.name);
      }
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save service";
      toast.error("Save failed", msg);
    }
  }

  async function handleDeactivate(service: SpaService) {
    try {
      await deleteService.mutateAsync(service.id);
      toast.success("Service removed", service.name);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove service";
      toast.error("Delete failed", msg);
    }
  }

  function toggleTherapist(id: string) {
    setForm((f) => ({
      ...f,
      therapist_ids: f.therapist_ids.includes(id)
        ? f.therapist_ids.filter((t) => t !== id)
        : [...f.therapist_ids, id],
    }));
  }

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Services", current: true }]}
        primaryAction={{
          label: "Add service",
          onClick: openCreate,
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Treatments and packages guests can book online.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiStat label="Total services" value={stats.total} icon={Sparkles} />
          <KpiStat label="Active" value={stats.active} />
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search services…"
            className="pl-9"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="grid grid-cols-[1fr_100px_120px_140px_88px] gap-3 border-b border-border bg-muted/30 px-4 py-3 label-cap">
            <span>Service</span>
            <span>Duration</span>
            <span>Price</span>
            <span>{term("resource", "Therapist")}s</span>
            <span>Status</span>
          </div>

          {isPending ? (
            <div className="p-8 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No services yet. Add your first treatment to start taking bookings.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((service) => (
                <li
                  key={service.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(service)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEdit(service);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[1fr_100px_120px_140px_88px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{service.name}</div>
                    {service.description && (
                      <div className="truncate text-xs text-muted-foreground">
                        {service.description}
                      </div>
                    )}
                  </div>
                  <span className="text-sm tabular-nums">{service.duration_mins} min</span>
                  <span className="text-sm tabular-nums">
                    {formatPrice(service.price_cents, service.currency)}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {service.therapists?.map((t) => t.name).join(", ") || "—"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      service.is_active ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {service.is_active ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit service" : "Add service"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-desc">Description</Label>
              <Input
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="svc-duration">Duration (minutes)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min={5}
                  value={form.duration_mins}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration_mins: Number(e.target.value) || 60 }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-price">Price (cents)</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  value={form.price_cents}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price_cents: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="svc-active">Active</Label>
              <Switch
                id="svc-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            {therapists.length > 0 && (
              <div className="space-y-2">
                <Label>Eligible {term("resources", "therapists").toLowerCase()}</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {therapists.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.therapist_ids.includes(t.id)}
                        onChange={() => toggleTherapist(t.id)}
                      />
                      {t.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDeactivate(editing)}
              >
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={!form.name.trim() || createService.isPending || updateService.isPending}
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
