/**
 * Table-availability colours for the guest venue map.
 *
 * NOTE: the floorStateBg / floorStateBorder / floorStateText helpers below are
 * currently UNUSED — table-floor-picker.tsx kept its own local pickerState*
 * functions, so the intended sharing never actually landed. Only the SVG
 * helpers (fill/stroke/label) are live, and they are consumed solely by
 * venue-map-canvas.tsx. Changing them cannot affect the staff floor picker.
 */

export type FloorState =
  | "available"
  | "busy"
  | "unfit"
  | "inactive"
  | "selected"
  | "current";

export function floorStateBg(state: FloorState): string {
  switch (state) {
    case "selected":
      return "bg-accent";
    case "current":
      return "bg-secondary";
    case "available":
      return "bg-card";
    case "busy":
      return "bg-destructive/10";
    case "unfit":
      return "bg-muted/60";
    case "inactive":
      return "bg-muted";
  }
}

export function floorStateBorder(state: FloorState): string {
  switch (state) {
    case "selected":
      return "border-foreground shadow-md ring-2 ring-accent/40";
    case "current":
      return "border-foreground/60 border-dashed";
    case "available":
      return "border-border";
    case "busy":
      return "border-destructive/50";
    case "unfit":
      return "border-dashed border-muted-foreground/40";
    case "inactive":
      return "border-muted-foreground/30";
  }
}

export function floorStateText(state: FloorState): string {
  switch (state) {
    case "selected":
      return "text-accent-foreground";
    case "current":
      return "text-foreground";
    case "busy":
      return "text-destructive";
    case "unfit":
      return "text-muted-foreground/70";
    case "inactive":
      return "text-muted-foreground";
    default:
      return "";
  }
}

/**
 * SVG variants, for the venue map.
 *
 * The `bg-*` / `border-*` classes above are CSS box properties and have NO
 * effect on an SVG <rect>/<circle> — shapes need `fill` and `stroke`.
 *
 * These deliberately diverge from the staff palette above. The staff floor
 * picker is a neutral working surface, but the guest map tells someone which
 * spots they can actually book, and the page says so in words: "Green is
 * available; red is already booked." Card-white and 20%-opacity terracotta did
 * not honour that. Fixed Tailwind hues rather than theme tokens because these
 * sit on top of arbitrary uploaded artwork, where a theme-following fill could
 * vanish into the picture.
 */
export function floorStateFill(state: FloorState): string {
  switch (state) {
    case "selected":
      return "fill-emerald-500";
    case "current":
      return "fill-secondary";
    case "available":
      return "fill-emerald-300";
    case "busy":
      return "fill-rose-300";
    case "unfit":
      return "fill-muted";
    case "inactive":
      return "fill-muted";
  }
}

export function floorStateStroke(state: FloorState): string {
  switch (state) {
    case "selected":
      return "stroke-emerald-900";
    case "current":
      return "stroke-foreground/60";
    case "available":
      return "stroke-emerald-700";
    case "busy":
      return "stroke-rose-700";
    case "unfit":
      return "stroke-muted-foreground/50";
    case "inactive":
      return "stroke-muted-foreground/30";
  }
}

/**
 * Label colour for a shape on the map.
 *
 * Cannot be `fill-foreground`: the fills above are fixed light hues, so in dark
 * mode a cream foreground would sit on pale green and be unreadable. These are
 * pinned dark to stay legible in both themes.
 */
export function floorStateLabel(state: FloorState): string {
  switch (state) {
    case "available":
    case "selected":
      return "fill-emerald-950";
    case "busy":
      return "fill-rose-950";
    case "unfit":
    case "inactive":
      return "fill-muted-foreground";
    case "current":
      return "fill-foreground";
  }
}

/**
 * A non-colour cue for each state. Colour alone must never carry meaning
 * (WCAG 1.4.1) — these glyphs ride alongside it.
 */
export function floorStateGlyph(state: FloorState): string | null {
  switch (state) {
    case "busy":
      return "×";
    case "unfit":
      return "–";
    case "selected":
      return "✓";
    default:
      return null;
  }
}
