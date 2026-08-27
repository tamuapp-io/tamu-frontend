/**
 * The colours a menu label may take.
 *
 * Staff pick a swatch from this fixed set rather than typing a hex, and the
 * database stores only the KEY — so contrast stays verified and both themes
 * keep working, instead of becoming whatever colour someone pasted in.
 *
 * Each pair is a light fill with a pinned-dark text colour, so the badge reads
 * identically in light and dark mode. Same reasoning as floor-state-colors.ts:
 * these sit on a card whose background follows the theme, but the badge itself
 * must not.
 */

export const MENU_LABEL_COLORS = [
  "rose",
  "amber",
  "emerald",
  "sky",
  "violet",
  "stone",
] as const;

export type MenuLabelColor = (typeof MENU_LABEL_COLORS)[number];

const SWATCHES: Record<MenuLabelColor, string> = {
  rose: "bg-rose-200 text-rose-950",
  amber: "bg-amber-200 text-amber-950",
  emerald: "bg-emerald-200 text-emerald-950",
  sky: "bg-sky-200 text-sky-950",
  violet: "bg-violet-200 text-violet-950",
  stone: "bg-stone-200 text-stone-900",
};

/** Badge classes for a label. Unknown keys fall back rather than render bare. */
export function menuLabelClass(color: string | null | undefined): string {
  return SWATCHES[(color ?? "stone") as MenuLabelColor] ?? SWATCHES.stone;
}

/** Just the fill, for the colour picker's swatches. */
export function menuLabelSwatch(color: MenuLabelColor): string {
  return SWATCHES[color].split(" ")[0];
}
