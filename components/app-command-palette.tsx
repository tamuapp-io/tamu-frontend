"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { APP_SECTIONS, GLOBAL_NAV_ITEMS, type AppNavItem } from "@/lib/nav-config";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCommandPaletteStore } from "@/lib/store/command-palette-store";

type CommandRow = AppNavItem & { group: string; external?: boolean };

function shouldBlockOpenShortcut(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return false;
}

export function AppCommandPalette() {
  const router = useRouter();
  const open = useCommandPaletteStore((s) => s.open);
  const setOpen = useCommandPaletteStore((s) => s.setOpen);
  const openSession = useCommandPaletteStore((s) => s.openSession);
  const tenant = useAuthStore((s) => s.tenant);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  // New session = palette just opened; clear field without coupling to Radix internals.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset when openSession bumps (closed → open) */
    setQuery("");
    setActive(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [openSession]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, openSession]);

  const rows = useMemo<CommandRow[]>(() => {
    const list: CommandRow[] = [];
    for (const item of GLOBAL_NAV_ITEMS) {
      if (item.disabled) continue;
      list.push({ ...item, group: "General" });
    }
    for (const section of APP_SECTIONS) {
      if (section.disabled) continue;
      for (const g of section.groups) {
        for (const item of g.items) {
          if (item.disabled) continue;
          list.push({ ...item, group: section.label });
        }
      }
    }
    if (tenant?.slug) {
      list.push({
        href: `/book/${tenant.slug}`,
        label: "View booking page",
        icon: ExternalLink,
        group: "Links",
        keywords: ["public", "widget", "guest"],
        external: true,
      });
    }
    return list;
  }, [tenant]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const hay = [
        row.label,
        row.href,
        row.group,
        ...(row.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const clampedActive = Math.min(active, Math.max(0, filtered.length - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;

      const { open, toggle } = useCommandPaletteStore.getState();
      if (!open && shouldBlockOpenShortcut(e.target)) return;

      e.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const goTo = useCallback(
    (row: CommandRow) => {
      setOpen(false);
      if (row.external) {
        window.open(row.href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(row.href);
    },
    [router, setOpen],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (filtered.length === 0 ? 0 : (i + 1) % filtered.length));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) =>
        filtered.length === 0 ? 0 : (i - 1 + filtered.length) % filtered.length,
      );
      return;
    }
    if (e.key === "Enter" && filtered[clampedActive]) {
      e.preventDefault();
      goTo(filtered[clampedActive]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl gap-3 p-0 sm:rounded-2xl"
        onKeyDown={onKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Jump to a page or open the booking page.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <Input
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search pages"
            placeholder="Search pages…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-[min(50vh,320px)] overflow-y-auto px-2 pb-2">
          {filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No matches.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5" role="listbox" aria-label="Results">
              {filtered.map((row, i) => {
                const Icon = row.icon;
                const selected = i === clampedActive;
                return (
                  <li key={`${row.href}-${row.label}`} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        selected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/60",
                      )}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => goTo(row)}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 font-medium">{row.label}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {row.group}
                        {row.external ? " · opens in new tab" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            ↑↓
          </kbd>{" "}
          navigate ·{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Enter
          </kbd>{" "}
          open ·{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Esc
          </kbd>{" "}
          close
        </p>
      </DialogContent>
    </Dialog>
  );
}
