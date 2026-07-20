"use client";

import { useMemo, useState } from "react";
import { FloorPlanPreview } from "@/components/floor-plan-preview";
import { cn } from "@/lib/utils";
import type { FloorSection, Reservation, Table } from "@/lib/types";

const UNASSIGNED = "Unassigned";

interface SectionedFloorPlanProps {
  tables: Table[];
  reservations?: Reservation[];
  /** Managed sections, for ordering + surfacing empty sections in the editor. */
  floorSections?: FloorSection[];
  interactive?: boolean;
  onTableClick?: (table: Table) => void;
  /**
   * Live service passes true: a section with no tables is not a floor plan
   * anyone is working, so it gets no tab. The editor passes false so you can
   * still open an empty section and lay it out.
   */
  hideEmpty?: boolean;
}

function sectionKey(table: Table): string {
  const s = (table.section ?? "").trim();
  return s === "" ? UNASSIGNED : s;
}

/**
 * One floor plan per section. Each section is its own canvas — switching the
 * section tab swaps which tables are shown — so a venue's Indoor, Terrace, and
 * Bar areas read as separate rooms rather than one crowded grid.
 */
export function SectionedFloorPlan({
  tables,
  reservations,
  floorSections,
  interactive = false,
  onTableClick,
  hideEmpty = false,
}: SectionedFloorPlanProps) {
  // section name -> its tables, preserving input order within a section.
  const grouped = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const t of tables) {
      const key = sectionKey(t);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return map;
  }, [tables]);

  // Ordered section names: managed sections (in their configured order) first,
  // then any legacy section still present on a table but not managed.
  const sections = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();

    for (const s of floorSections ?? []) {
      if (s.is_active === false) continue;
      if (!seen.has(s.name)) {
        ordered.push(s.name);
        seen.add(s.name);
      }
    }
    for (const key of grouped.keys()) {
      if (!seen.has(key)) {
        ordered.push(key);
        seen.add(key);
      }
    }

    return hideEmpty
      ? ordered.filter((name) => (grouped.get(name)?.length ?? 0) > 0)
      : ordered;
  }, [floorSections, grouped, hideEmpty]);

  const [active, setActive] = useState<string | null>(null);
  const activeSection =
    active && sections.includes(active) ? active : (sections[0] ?? null);

  if (sections.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
        {hideEmpty
          ? "No tables on the floor yet. Add tables to a section to see them here."
          : "No sections yet. Add a section to start a floor plan."}
      </div>
    );
  }

  const activeTables = activeSection ? (grouped.get(activeSection) ?? []) : [];

  return (
    <div className="space-y-3">
      {/* Section switcher — each is a distinct floor plan. */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Floor sections">
        {sections.map((name) => {
          const count = grouped.get(name)?.length ?? 0;
          const isActive = name === activeSection;
          return (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(name)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted/50",
              )}
            >
              {name}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  isActive ? "bg-background text-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTables.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
          No tables in {activeSection} yet.
        </div>
      ) : (
        <FloorPlanPreview
          key={activeSection ?? "none"}
          tables={activeTables}
          reservations={reservations}
          interactive={interactive}
          onTableClick={onTableClick}
        />
      )}
    </div>
  );
}
