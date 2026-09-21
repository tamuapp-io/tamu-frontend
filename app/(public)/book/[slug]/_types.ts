/**
 * The shape of one guest's in-progress booking, shared by the flow hook, the
 * step components and every theme shell.
 *
 * Kept in its own module because all three import it: putting it in the page
 * or in `_steps` would make the shells import from a component file purely for
 * a type, and a stray value import would then drag the whole step tree into
 * anything that only wanted the type.
 */
import type { MenuOrderLine, PublicAvailabilitySlot } from "@/lib/types";

export type Step =
  | "service"
  | "date"
  | "slot"
  | "section"
  | "table"
  | "menu"
  | "details"
  | "done";

export interface BookingState {
  service_id: string | null;
  therapist_id: string | null;
  date: string;
  party_size: number;
  slot: PublicAvailabilitySlot | null;
  section_id: string | null;
  section_name: string | null;
  table_id: string | null;
  /** Mutually exclusive with `table_id` — the server rejects both together. */
  combination_id: string | null;
  /** Pre-ordered menu lines. Ids and quantities only — never prices. */
  menu_lines: MenuOrderLine[];
  guest: {
    name: string;
    email: string;
    phone: string;
    marketing_opt_in: boolean;
    birthday_month: number | null;
    birthday_day: number | null;
  };
  occasion: string;
  special_requests: string;
  custom_fields: Record<string, string>;
}

