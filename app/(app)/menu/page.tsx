"use client";

import { useMemo, useRef, useState } from "react";
import { ImagePlus, Plus, Tag, Trash2, UtensilsCrossed } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import {
  MENU_LABEL_COLORS,
  menuLabelClass,
  menuLabelSwatch,
  type MenuLabelColor,
} from "@/components/menu-label-colors";
import { uploadMenuImage } from "@/lib/api/menu";
import { useMenu, useMenuMutations } from "@/lib/hooks/use-menu";
import { ApiError } from "@/lib/api/client";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuCategory, MenuItem, MenuMode } from "@/lib/types";

function msg(e: unknown): string | undefined {
  return e instanceof ApiError ? e.message : undefined;
}

export default function MenuPage() {
  const { data, isPending } = useMenu();
  const m = useMenuMutations();

  const [newCategory, setNewCategory] = useState("");
  const [editing, setEditing] = useState<{ item: MenuItem | null; categoryId: string } | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const categories = useMemo(() => data?.categories ?? [], [data]);
  const labels = useMemo(() => data?.labels ?? [], [data]);

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    m.createCategory.mutate(
      { name },
      {
        onSuccess: () => setNewCategory(""),
        onError: (e) => toast.error("Couldn't add category", msg(e)),
      },
    );
  };

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Menu", current: true }]}
        primaryAction={{
          label: "Manage labels",
          onClick: () => setLabelsOpen(true),
        }}
      />

      <div className="space-y-5 p-6">
        {isPending ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <>
            <ModeCard
              mode={data?.mode ?? "off"}
              visible={data?.visible ?? false}
              orderingEnabled={data?.ordering_enabled ?? false}
              addonGranted={data?.addon_granted ?? false}
              gatewayConnected={data?.gateway_connected ?? false}
            />

            <Card className="flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-[220px] flex-1 space-y-1.5">
                <Label htmlFor="new-category">New category</Label>
                <Input
                  id="new-category"
                  placeholder="Starters, Mains, Drinks…"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
              </div>
              <Button onClick={addCategory} disabled={!newCategory.trim() || m.createCategory.isPending}>
                <Plus className="h-4 w-4" /> Add category
              </Button>
            </Card>

            {categories.length === 0 && (
              <Card className="grid place-items-center gap-2 p-10 text-center">
                <UtensilsCrossed className="h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">No menu yet</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Start with a category above, then put dishes inside it. Your menu appears on your
                  booking page as soon as it has something active in it.
                </p>
              </Card>
            )}

            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                labels={labels}
                onAddItem={() => setEditing({ item: null, categoryId: category.id })}
                onEditItem={(item) => setEditing({ item, categoryId: category.id })}
              />
            ))}

          </>
        )}
      </div>

      {editing && (
        <ItemDialog
          open
          categoryId={editing.categoryId}
          item={editing.item}
          labels={labels}
          onClose={() => setEditing(null)}
        />
      )}

      <LabelsDialog open={labelsOpen} onClose={() => setLabelsOpen(false)} labels={labels} />
    </>
  );
}

/* ── What the menu does on the booking page ───────────────────────────── */

const MODES: { value: MenuMode; label: string; blurb: string }[] = [
  { value: "off", label: "Off", blurb: "Guests never see the menu." },
  { value: "display", label: "Display only", blurb: "Guests can browse it, but not order." },
  {
    value: "order",
    label: "Order only",
    blurb: "Only orderable dishes are shown, and only while guests can order.",
  },
  {
    value: "both",
    label: "Display & order",
    blurb: "Always shown; orderable whenever payments are live.",
  },
];

function ModeCard({
  mode,
  visible,
  orderingEnabled,
  addonGranted,
  gatewayConnected,
}: {
  mode: MenuMode;
  visible: boolean;
  orderingEnabled: boolean;
  addonGranted: boolean;
  gatewayConnected: boolean;
}) {
  const m = useMenuMutations();

  // "Order only" silently hides the whole menu when ordering isn't possible.
  // That is exactly what it's for, but it looks like a bug from in here, so say
  // it out loud rather than leaving staff to wonder where their menu went.
  const hiddenByOrderOnly = mode === "order" && !orderingEnabled;

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold">Guests see</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            disabled={m.setMode.isPending}
            onClick={() =>
              m.setMode.mutate(option.value, {
                onError: (e) => toast.error("Couldn't change the menu mode", msg(e)),
              })
            }
            className={cn(
              "rounded-xl border p-3 text-left transition-colors",
              mode === option.value
                ? "border-foreground/30 bg-muted"
                : "border-border hover:bg-muted/50",
            )}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
          </button>
        ))}
      </div>

      {mode !== "off" && !visible && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {hiddenByOrderOnly
            ? "Your menu is hidden right now: \u201cOrder only\u201d shows it just when guests can order, and pre-ordering isn't available yet. Connect a payment gateway and add the pre-ordering add-on, or switch to \u201cDisplay only\u201d."
            : "Your menu is hidden right now because nothing in it is active. Switch on at least one item in an active category."}
        </p>
      )}

      {mode !== "off" && visible && !orderingEnabled && mode !== "display" && (
        <p className="mt-3 text-xs text-muted-foreground">
          {/* Name the one thing that's actually missing. Listing both when the
              add-on is already granted reads as though the mode didn't take. */}
          Guests can browse but not order —{" "}
          {!gatewayConnected && !addonGranted
            ? "this needs the pre-ordering add-on and a connected payment gateway."
            : !gatewayConnected
              ? "connect a payment gateway in Settings to start taking pre-orders."
              : "the Menu pre-ordering add-on isn't active for this venue yet."}
        </p>
      )}
    </Card>
  );
}

/* ── One category and its items ───────────────────────────────────────── */

function CategoryCard({
  category,
  labels,
  onAddItem,
  onEditItem,
}: {
  category: MenuCategory;
  labels: { id: string; name: string; color: string }[];
  onAddItem: () => void;
  onEditItem: (item: MenuItem) => void;
}) {
  const m = useMenuMutations();
  const active = category.is_active !== false;

  return (
    <Card className={cn("p-4", !active && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {category.name}
            {!active && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Hidden
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {category.items.length} {category.items.length === 1 ? "item" : "items"}
            {!active && " · guests can't see any of them while this category is off"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id={`cat-${category.id}`}
              checked={active}
              onCheckedChange={(checked) =>
                m.updateCategory.mutate(
                  { id: category.id, is_active: checked },
                  { onError: (e) => toast.error("Couldn't update category", msg(e)) },
                )
              }
            />
            <Label htmlFor={`cat-${category.id}`} className="cursor-pointer text-xs">
              Visible
            </Label>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAddItem}>
            <Plus className="h-3.5 w-3.5" /> Item
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${category.name}`}
            onClick={() =>
              m.removeCategory.mutate(category.id, {
                onError: (e) => toast.error("Couldn't delete category", msg(e)),
              })
            }
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {category.items.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {category.items.map((item) => {
            const label = labels.find((l) => l.id === item.menu_label_id);
            const itemActive = item.is_active !== false;

            return (
              <li key={item.id} className={cn("flex items-center gap-3 py-3", !itemActive && "opacity-60")}>
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt=""
                    aria-hidden
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-muted">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onEditItem(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {item.name}
                    {label && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          menuLabelClass(label.color),
                        )}
                      >
                        {label.name}
                      </span>
                    )}
                    {!itemActive && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </button>

                <span className="shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(item.price_cents, "IDR")}
                </span>

                <Switch
                  checked={itemActive}
                  aria-label={`${itemActive ? "Hide" : "Show"} ${item.name}`}
                  onCheckedChange={(checked) =>
                    m.updateItem.mutate(
                      { id: item.id, is_active: checked },
                      { onError: (e) => toast.error("Couldn't update item", msg(e)) },
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${item.name}`}
                  onClick={() =>
                    m.removeItem.mutate(item.id, {
                      onError: (e) => toast.error("Couldn't delete item", msg(e)),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ── Create / edit one item ───────────────────────────────────────────── */

function ItemDialog({
  open,
  categoryId,
  item,
  labels,
  onClose,
}: {
  open: boolean;
  categoryId: string;
  item: MenuItem | null;
  labels: { id: string; name: string; color: string }[];
  onClose: () => void;
}) {
  const m = useMenuMutations();
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  // Shown in rupiah, stored as TRUE cents (x100).
  const [price, setPrice] = useState(item ? String(item.price_cents / 100) : "");
  const [labelId, setLabelId] = useState<string | null>(item?.menu_label_id ?? null);
  const [image, setImage] = useState<{ url: string; path: string; disk: string } | null>(
    item?.image_url ? { url: item.image_url, path: "", disk: "" } : null,
  );
  const [uploading, setUploading] = useState(false);
  const [orderable, setOrderable] = useState(item?.is_orderable !== false);

  // Labels used to be creatable only from the topbar dialog, so anyone naming a
  // dish had to abandon it, make a label, and start over — and with none created
  // yet the picker was a dead end reading "None".
  const [newLabel, setNewLabel] = useState<{ name: string; color: MenuLabelColor } | null>(null);

  const createLabel = () => {
    const name = newLabel?.name.trim();
    if (!name) return;

    m.createLabel.mutate(
      { name, color: newLabel!.color },
      {
        // Select it straight away: they only opened this to use it.
        onSuccess: (res) => {
          setLabelId(res.data.id);
          setNewLabel(null);
        },
        onError: (e) => toast.error("Couldn't add label", msg(e)),
      },
    );
  };

  const pickImage = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadMenuImage(file);
      setImage(result.data);
    } catch (e) {
      toast.error("Couldn't upload image", msg(e));
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    const rupiah = Number(price.trim() || 0);
    if (!name.trim() || !Number.isFinite(rupiah) || rupiah < 0) return;

    const payload = {
      menu_category_id: categoryId,
      menu_label_id: labelId,
      name: name.trim(),
      description: description.trim() || null,
      price_cents: Math.round(rupiah * 100),
      is_orderable: orderable,
      ...(image && image.path
        ? { image_url: image.url, image_path: image.path, image_disk: image.disk }
        : {}),
    };

    const onDone = {
      onSuccess: () => onClose(),
      onError: (e: unknown) => toast.error("Couldn't save item", msg(e)),
    };

    if (item) m.updateItem.mutate({ id: item.id, ...payload }, onDone);
    else m.createItem.mutate(payload, onDone);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New item"}</DialogTitle>
          <DialogDescription>
            Guests see this on your booking page. Price is what they pay if they pre-order it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-desc">Description</Label>
            <Input
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Wok-fried rice, fried egg, prawn crackers"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-price">Price (IDR)</Label>
            <Input
              id="item-price"
              type="number"
              min={0}
              step={1000}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Label</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLabelId(null)}
                aria-pressed={labelId === null}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs",
                  labelId === null ? "border-foreground/40 bg-muted" : "border-border",
                )}
              >
                None
              </button>
              {labels.map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => setLabelId(label.id)}
                  aria-pressed={labelId === label.id}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium ring-offset-background",
                    menuLabelClass(label.color),
                    labelId === label.id && "ring-2 ring-foreground ring-offset-1",
                  )}
                >
                  {label.name}
                </button>
              ))}

              {newLabel === null && (
                <button
                  type="button"
                  onClick={() => setNewLabel({ name: "", color: "rose" })}
                  className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
                >
                  + New label
                </button>
              )}
            </div>

            {newLabel !== null && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex gap-2">
                  <Input
                    aria-label="New label name"
                    placeholder="Spicy"
                    value={newLabel.name}
                    autoFocus
                    onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        // Otherwise this submits the surrounding item form.
                        e.preventDefault();
                        createLabel();
                      }
                      if (e.key === "Escape") setNewLabel(null);
                    }}
                  />
                  <Button
                    type="button"
                    onClick={createLabel}
                    disabled={!newLabel.name.trim() || m.createLabel.isPending}
                  >
                    Add
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setNewLabel(null)}>
                    Cancel
                  </Button>
                </div>
                <div className="flex gap-2">
                  {MENU_LABEL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      aria-pressed={newLabel.color === c}
                      onClick={() => setNewLabel({ ...newLabel, color: c })}
                      className={cn(
                        "h-6 w-6 rounded-full ring-offset-background",
                        menuLabelSwatch(c),
                        newLabel.color === c && "ring-2 ring-foreground ring-offset-2",
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="item-orderable" className="cursor-pointer">
                Guests can pre-order this
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Turn off for anything cooked to order or priced on the day — it still shows on the
                menu, just without an add button.
              </p>
            </div>
            <Switch
              id="item-orderable"
              checked={orderable}
              onCheckedChange={setOrderable}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Photo</Label>
            <div className="flex items-center gap-3">
              {image?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image.url} alt="" aria-hidden className="h-16 w-16 rounded-md object-cover" />
              )}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void pickImage(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {uploading ? "Uploading…" : image?.url ? "Replace photo" : "Add photo"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!name.trim() || m.createItem.isPending || m.updateItem.isPending}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Reusable labels ──────────────────────────────────────────────────── */

function LabelsDialog({
  open,
  onClose,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  labels: { id: string; name: string; color: string }[];
}) {
  const m = useMenuMutations();
  const [name, setName] = useState("");
  const [color, setColor] = useState<MenuLabelColor>("rose");

  const add = () => {
    if (!name.trim()) return;
    m.createLabel.mutate(
      { name: name.trim(), color },
      {
        onSuccess: () => setName(""),
        onError: (e) => toast.error("Couldn't add label", msg(e)),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Labels</DialogTitle>
          <DialogDescription>
            Short badges like &ldquo;Chef&apos;s pick&rdquo; or &ldquo;Spicy&rdquo;. Guests can
            filter the menu by them, which is why they&apos;re shared rather than typed per item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {labels.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No labels yet.
            </p>
          )}
          {labels.map((label) => (
            <div key={label.id} className="flex items-center justify-between gap-2">
              <span
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium", menuLabelClass(label.color))}
              >
                {label.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${label.name}`}
                onClick={() =>
                  m.removeLabel.mutate(label.id, {
                    onError: (e) => toast.error("Couldn't delete label", msg(e)),
                  })
                }
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t border-border pt-3">
          <Label htmlFor="label-name">New label</Label>
          <div className="flex gap-2">
            <Input
              id="label-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Spicy"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
            <Button onClick={add} disabled={!name.trim() || m.createLabel.isPending}>
              <Tag className="h-4 w-4" /> Add
            </Button>
          </div>
          {/* A fixed palette, not a colour picker — contrast stays verified. */}
          <div className="flex gap-2 pt-1">
            {MENU_LABEL_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full ring-offset-background transition-shadow",
                  menuLabelSwatch(c),
                  color === c && "ring-2 ring-foreground ring-offset-2",
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
