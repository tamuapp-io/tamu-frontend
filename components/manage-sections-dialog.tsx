"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useFloorSectionMutations, useFloorSections } from "@/lib/hooks/use-tables";

function msg(e: unknown): string | undefined {
  return e instanceof ApiError ? e.message : undefined;
}

export function ManageSectionsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: sections = [], isPending } = useFloorSections();
  const { create, rename, remove, reorder } = useFloorSectionMutations();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const add = () => {
    const name = newName.trim();
    if (!name) return;
    create.mutate(name, {
      onSuccess: () => setNewName(""),
      onError: (e) => toast.error("Couldn't add section", msg(e)),
    });
  };

  const saveRename = (id: string) => {
    const name = editName.trim();
    if (!name) return;
    rename.mutate(
      { id, name },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) => toast.error("Couldn't rename section", msg(e)),
      },
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((s) => s.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage sections</DialogTitle>
          <DialogDescription>
            Areas of your venue — Indoor, Outdoor, First floor, etc. Renaming a
            section updates every table in it; deleting it leaves those tables
            unassigned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          {isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : sections.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No sections yet — add your first below.
            </p>
          ) : (
            sections.map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
              >
                <div className="flex flex-col text-muted-foreground">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === sections.length - 1}
                    onClick={() => move(i, 1)}
                    className="hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                {editingId === s.id ? (
                  <>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveRename(s.id)}
                      className="h-8 flex-1"
                      autoFocus
                    />
                    <Button size="sm" variant="ghost" onClick={() => saveRename(s.id)} aria-label="Save">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel">
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.tables_count ?? 0} tables</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Rename"
                      onClick={() => {
                        setEditingId(s.id);
                        setEditName(s.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Delete"
                      onClick={() =>
                        remove.mutate(s.id, {
                          onError: (e) => toast.error("Couldn't delete section", msg(e)),
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 border-t border-border pt-3">
          <Input
            placeholder="New section name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="h-9"
          />
          <Button onClick={add} disabled={create.isPending || !newName.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
