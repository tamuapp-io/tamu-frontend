"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Minus, Plus, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { menuLabelClass } from "@/components/menu-label-colors";
import { publicMenuApi } from "@/lib/api/menu";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuItem, MenuOrderLine } from "@/lib/types";

/**
 * The guest's menu step. Always skippable.
 *
 * When the venue has no ordering add-on or no payment gateway the same menu
 * renders read-only — browsing is free for every venue, only taking money is
 * gated. That is why this component keys off `ordering_enabled` rather than
 * being omitted from the flow entirely.
 */
export function StepMenu({
  slug,
  lines,
  onChange,
  onBack,
  onNext,
}: {
  slug: string;
  lines: MenuOrderLine[];
  onChange: (lines: MenuOrderLine[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const query = useQuery({
    queryKey: ["public", slug, "menu"],
    queryFn: async () => (await publicMenuApi.get(slug)).data,
  });

  const [labelFilter, setLabelFilter] = useState<string | null>(null);

  /**
   * Which categories are expanded.
   *
   * Keyed by the active filter so toggles reset when it changes: a category the
   * guest collapsed staying shut under a new filter makes the filter look
   * broken. Derived rather than synced in an effect.
   */
  const [openState, setOpenState] = useState<{ key: string; map: Record<string, boolean> }>({
    key: "",
    map: {},
  });

  // Memoised because `?? []` mints a new array every render, which would make
  // every useMemo below recompute on each one.
  const categories = useMemo(() => query.data?.categories ?? [], [query.data]);
  const labels = useMemo(() => query.data?.labels ?? [], [query.data]);
  const canOrder = query.data?.ordering_enabled === true;

  const quantities = useMemo(() => {
    const map = new Map<string, number>();
    for (const line of lines) map.set(line.id, line.quantity);
    return map;
  }, [lines]);

  // Only labels actually worn by a visible item become chips — offering a
  // filter that empties the whole menu is a dead end.
  const usableLabels = useMemo(() => {
    const worn = new Set(
      categories.flatMap((c) => c.items.map((i) => i.menu_label_id)).filter(Boolean),
    );
    return labels.filter((l) => worn.has(l.id));
  }, [categories, labels]);

  const visible = useMemo(
    () =>
      categories
        .map((c) => ({
          ...c,
          items: labelFilter ? c.items.filter((i) => i.menu_label_id === labelFilter) : c.items,
        }))
        .filter((c) => c.items.length > 0),
    [categories, labelFilter],
  );

  const filterKey = labelFilter ?? "";
  const overrides = openState.key === filterKey ? openState.map : {};
  const setOpen = (id: string, open: boolean) =>
    setOpenState({ key: filterKey, map: { ...overrides, [id]: open } });

  /**
   * Collapsed by default — a long menu shouldn't shove the booking off screen.
   *
   * Two exceptions, both cases where collapsing reads as broken rather than
   * tidy: a lone category (nothing to scan past, so the click is pure friction),
   * and any category while a label filter is on (the guest just asked to see
   * those items, so hiding them makes the filter look like it did nothing).
   */
  const isOpen = (id: string) => overrides[id] ?? (visible.length === 1 || labelFilter !== null);

  const setQuantity = (item: MenuItem, next: number) => {
    const clamped = Math.max(0, Math.min(20, next));
    const without = lines.filter((l) => l.id !== item.id);
    onChange(clamped === 0 ? without : [...without, { id: item.id, quantity: clamped }]);
  };

  // Totalled from the same prices the server will charge; the server recomputes
  // it regardless, so this is a preview, never the source of truth.
  const total = useMemo(() => {
    const prices = new Map(
      categories.flatMap((c) => c.items).filter((i) => i.orderable).map((i) => [i.id, i.price_cents]),
    );
    return lines.reduce((sum, l) => sum + (prices.get(l.id) ?? 0) * l.quantity, 0);
  }, [categories, lines]);

  const count = lines.reduce((n, l) => n + l.quantity, 0);

  if (query.isPending) return <Skeleton className="h-96 w-full" />;

  // A venue with no menu shouldn't strand the guest on an empty step.
  if (query.isError || categories.length === 0) {
    return (
      <Card className="p-6">
        <h2 className="text-lg font-semibold">Add to your booking</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This venue hasn&apos;t published a menu yet.
        </p>
        <div className="mt-6 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button type="button" onClick={onNext}>
            Continue
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <UtensilsCrossed className="h-5 w-5 text-muted-foreground" aria-hidden />
        {canOrder ? "Pre-order from the menu" : "Menu"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {canOrder
          ? "Optional — add anything you'd like waiting for you, and pay for it with your booking."
          : "Have a look at what's on offer. This venue takes orders when you arrive."}
      </p>

      {usableLabels.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by label">
          <button
            type="button"
            onClick={() => setLabelFilter(null)}
            aria-pressed={labelFilter === null}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              labelFilter === null ? "border-foreground/30 bg-muted" : "border-border hover:bg-muted/50",
            )}
          >
            All
          </button>
          {usableLabels.map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => setLabelFilter(labelFilter === label.id ? null : label.id)}
              aria-pressed={labelFilter === label.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                labelFilter === label.id
                  ? "border-foreground/30 bg-muted"
                  : "border-border hover:bg-muted/50",
              )}
            >
              {label.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 divide-y divide-border border-y border-border">
        {visible.map((category) => {
          const open = isOpen(category.id);
          const added = category.items.reduce((n, i) => n + (quantities.get(i.id) ?? 0), 0);
          const panelId = `menu-cat-${category.id}`;

          return (
            <section key={category.id}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(category.id, !open)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  // 44px: a phone-first flow, and this is now the primary control.
                  className="flex min-h-[44px] w-full items-center gap-3 py-2 text-left"
                >
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                    aria-hidden
                  />
                  <span className="flex-1 text-sm font-medium">{category.name}</span>
                  {/* Surfaced on the header so a collapsed category never hides
                      what the guest has already chosen. */}
                  {added > 0 && (
                    <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                      {added} added
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {category.items.length}
                  </span>
                </button>
              </h3>

              {open && (
                <ul id={panelId} className="space-y-2 pb-3">
                  {category.items.map((item) => {
                    const label = labels.find((l) => l.id === item.menu_label_id);
                    const quantity = quantities.get(item.id) ?? 0;

                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex gap-3 rounded-xl border p-3 transition-colors",
                          quantity > 0 ? "border-foreground/30 bg-muted/40" : "border-border",
                        )}
                      >
                        {item.image_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image_url}
                            alt=""
                            aria-hidden
                            loading="lazy"
                            className="h-20 w-20 shrink-0 rounded-lg object-cover"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{item.name}</span>
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
                          </div>
                          {item.description && (
                            <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                          )}
                          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-medium">
                            {formatMoney(item.price_cents, "IDR")}
                            {canOrder && !item.orderable && (
                              <span className="text-xs font-normal text-muted-foreground">
                                available on arrival
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Per item, not per venue: `both` mode lists dine-in-only
                            dishes next to orderable ones. */}
                        {item.orderable && (
                          <div className="flex shrink-0 items-center gap-1.5 self-center">
                            {quantity > 0 && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-11 w-11 shrink-0 p-0"
                                  aria-label={`Remove one ${item.name}`}
                                  onClick={() => setQuantity(item, quantity - 1)}
                                >
                                  <Minus className="h-4 w-4" aria-hidden />
                                </Button>
                                <span
                                  className="w-6 text-center text-sm font-semibold tabular-nums"
                                  aria-live="polite"
                                >
                                  {quantity}
                                </span>
                              </>
                            )}
                            <Button
                              type="button"
                              variant={quantity > 0 ? "outline" : "default"}
                              className="h-11 w-11 shrink-0 p-0"
                              aria-label={`Add one ${item.name}`}
                              onClick={() => setQuantity(item, quantity + 1)}
                            >
                              <Plus className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {canOrder && count > 0 && (
        <p className="mt-5 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium">
            {count} {count === 1 ? "item" : "items"}
          </span>{" "}
          — {formatMoney(total, "IDR")}, added to your booking payment.
        </p>
      )}

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button type="button" onClick={onNext}>
          {canOrder && count === 0 ? "Skip" : "Continue"}
        </Button>
      </div>
    </Card>
  );
}
