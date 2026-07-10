"use client";

import { useMemo, useState } from "react";
import { DoorOpen, Plus, Search } from "lucide-react";
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
  useCreateRoom,
  useDeleteRoom,
  useRoomsList,
  useUpdateRoom,
} from "@/lib/hooks/use-spa-catalog";
import type { SpaRoom } from "@/lib/types";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils";

export default function RoomsPage() {
  const { data: rooms = [], isPending } = useRoomsList();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SpaRoom | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", is_active: true });

  const stats = useMemo(() => {
    const active = rooms.filter((r) => r.is_active);
    return { total: rooms.length, active: active.length };
  }, [rooms]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rooms;
    const q = search.trim().toLowerCase();
    return rooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [rooms, search]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", is_active: true });
    setOpen(true);
  }

  function openEdit(room: SpaRoom) {
    setEditing(room);
    setForm({ name: room.name, is_active: room.is_active });
    setOpen(true);
  }

  async function handleSave() {
    const payload = { name: form.name.trim(), is_active: form.is_active };
    try {
      if (editing) {
        await updateRoom.mutateAsync({ id: editing.id, payload });
        toast.success("Room updated", editing.name);
      } else {
        await createRoom.mutateAsync(payload);
        toast.success("Room created", payload.name);
      }
      setOpen(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not save room";
      toast.error("Save failed", msg);
    }
  }

  async function handleDeactivate(room: SpaRoom) {
    try {
      await deleteRoom.mutateAsync(room.id);
      toast.success("Room removed", room.name);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Could not remove room";
      toast.error("Delete failed", msg);
    }
  }

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Rooms", current: true }]}
        primaryAction={{
          label: "Add room",
          onClick: openCreate,
          icon: <Plus className="h-4 w-4" />,
        }}
      />

      <main className="flex-1 space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Treatment rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Rooms used for double-booking prevention alongside therapists.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiStat label="Total rooms" value={stats.total} icon={DoorOpen} />
          <KpiStat label="Active" value={stats.active} />
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rooms…"
            className="pl-9"
          />
        </div>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="grid grid-cols-[1fr_88px] gap-3 border-b border-border bg-muted/30 px-4 py-3 label-cap">
            <span>Room</span>
            <span>Status</span>
          </div>

          {isPending ? (
            <div className="p-8 text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No rooms yet. Add treatment rooms so appointments can be scheduled.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((room) => (
                <li
                  key={room.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEdit(room)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEdit(room);
                    }
                  }}
                  className="grid cursor-pointer grid-cols-[1fr_88px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <span className="text-sm font-medium">{room.name}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      room.is_active ? "text-emerald-700" : "text-muted-foreground",
                    )}
                  >
                    {room.is_active ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit room" : "Add room"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rm-name">Name</Label>
              <Input
                id="rm-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="rm-active">Active</Label>
              <Switch
                id="rm-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
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
                disabled={!form.name.trim() || createRoom.isPending || updateRoom.isPending}
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
