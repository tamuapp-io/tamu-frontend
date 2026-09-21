/**
 * Theme id → layout shell.
 *
 * The registry in lib/booking-themes carries the data half (names, swatches,
 * requirements) and stays free of React so Settings can import it; this is the
 * component half, and lives beside the page because that is what it renders.
 */
import type { BookingThemeId } from "@/lib/booking-themes/registry";
import type { BookingFlow } from "../_use-booking-flow";
import { AtlasShell } from "./atlas";
import { SajianShell } from "./sajian";
import { SesiShell } from "./sesi";

export type BookingShell = (props: { flow: BookingFlow }) => React.ReactElement;

export const BOOKING_SHELLS: Record<BookingThemeId, BookingShell> = {
  sajian: SajianShell,
  atlas: AtlasShell,
  sesi: SesiShell,
};
