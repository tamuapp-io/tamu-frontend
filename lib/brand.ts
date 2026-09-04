/**
 * A venue's `brand_color` is free text its owner typed into a settings field.
 * It reaches us as JSON and ends up in a CSS custom property, so it is guarded
 * here as well as at the API boundary — a component must never interpolate a
 * server-supplied string into `style` on the server's say-so alone.
 */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function safeBrandColor(value: string | null | undefined): string | null {
  return typeof value === "string" && HEX.test(value) ? value : null;
}
