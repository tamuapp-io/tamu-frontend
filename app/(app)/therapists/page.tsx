"use client";

import { useMemo, useState } from "react";
import { Hand, Plus, Search } from "lucide-react";
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
  useCreateTherapist,
  useDeleteTherapist,
  useServicesList,
  useTherapistsList,
  useUpdateTherapist,
} from "@/lib/hooks/use-spa-catalog";
import { useCategory } from "@/lib/hooks/use-category";
import type { Therapist } from "@/lib/types";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export default function TherapistsPage() {
  const { term } = useCategory();
  const resourceLabel = term("resources", "Therapists");
  const { data: therapists = [], isPending } = useTherapistsList();
  const { data: services = [] } = useServicesList();
  const createTherapist = useCreateTherapist();
  const updateTherapist = useUpdateTherapist();
  const deleteTherapist = useDeleteTherapist();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Therapist | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    bio: "",
    is_active: true,
    service_ids: [] as string[],
  });

  const stats = useMemo(() => {
    const active = therapists.filter((t) => t.is_active);
    return { total: therapists.length, active: active.length };
  }, [therapists]);

  const filtered = useMemo(() => {
    if (!search.trim()) return therapists;
    const q = search.trim().toLowerCase();
    return therapists.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.bio ?? "").toLowerCase().includes(q),
    );
  }, [therapists, search]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", bio: "", is_active: true, service_ids: [] });
    setOpen(true);
  }

  function openEdit(therapist: Therapist) {
    setEditing(therapist);
    setForm({
      name: therapist.name,
      bio: therapist.bio ?? "",
      is_active: therapist.is_active,
      service_ids: therapist.service_ids ?? therapist.services?.map((s) => s.id) ?? [],
    });
    setOpen(true);
  }

  async function handleSave() {
    const payload = {
      name: form.name.trim(),
      bio: form.bio.trim() || null,
      is_active: form.is_active,
      service_ids: form.service_ids,
    };
    try {
      if (editing) {
        await updateTherapist.mutateAsync({ id: editing.id, payload });
        toast.success(`${resourceLabel.slice(0, -1)} updated`, editing.name);
      } else {
        await createTherapist.mutateAsync(payload);
        toast.success(`${resourceLabel.slice(0, -1)} created`, payload.name);
      }
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save";
      toast.error("Save failed", msg);
    }
  }

  async function handleDeactivate(therapist: Therapist) {
    try {
      await deleteTherapist.mutateAsync(therapist.id);
      toast.success(`${resourceLabel.slice(0, -1)} removed`, therapist.name);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove";
      toast.error("Delete failed", msg);
    }
  }

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      service_ids: f.service_ids.includes(id)
        ? f.service_ids.filter((s) => s !== id)
        : [...f.service_ids, id],
    }));
  }

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: resourceLabel, current: true }]}
        primaryAction={{
          label: `Add ${term("resource", "therapist").toLowerCase()}`,
          onClick: openCreate,
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{resourceLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Staff who perform treatments and appear in the booking flow.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiStat label={`Total ${resourceLabel.toLowerCase()}`} value={stats.total} icon={Hand} />
          <KpiStat label="Active" value={stats.active} />
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${resourceLabel.toLowerCase()}…`}
            className="pl-9"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="grid grid-cols-[1fr_1fr_88px] gap-3 border-b border-border bg-muted/30 px-4 py-3 label-cap">
            <span>Name</span>
            <span>Services</span>
            <span>Status</span>
          </div>

          {isPending ? (
            <div className="p-8 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No {resourceLabel.toLowerCase()} yet.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((therapist) => (
                <li
                  key={therapist.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(therapist)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEdit(therapist);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[1fr_1fr_88px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{therapist.name}</div>
                    {therapist.bio && (
                      <div className="truncate text-xs text-muted-foreground">{therapist.bio}</div>
                    )}
                  </div>
                  <span className="truncate text-sm text-muted-foreground">
                    {therapist.services?.map((s) => s.name).join(", ") || "—"}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      therapist.is_active ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {therapist.is_active ? "Active" : "Inactive"}
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
            <DialogTitle>
              {editing ? `Edit ${term("resource", "therapist").toLowerCase()}` : `Add ${term("resource", "therapist").toLowerCase()}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="th-name">Name</Label>
              <Input
                id="th-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="th-bio">Bio</Label>
              <Input
                id="th-bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="th-active">Active</Label>
              <Switch
                id="th-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            {services.length > 0 && (
              <div className="space-y-2">
                <Label>Services they can perform</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {services.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.service_ids.includes(s.id)}
                        onChange={() => toggleService(s.id)}
                      />
                      {s.name}
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
                disabled={!form.name.trim() || createTherapist.isPending || updateTherapist.isPending}
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
