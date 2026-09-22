"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { todayISO } from "./_steps";
import type { BookingState, Step } from "./_types";
import type {
  MenuOrderLine,
  PublicReservation,
  PublicTenant,
  VenueMapCombination,
  VenueMapSectionSummary,
  VenueMapTable,
} from "@/lib/types";

/**
 * The booking flow with no opinion about how it looks.
 *
 * Themes differ in where the steps sit on the screen, never in what follows
 * what — so the order lives here once. Each shell spreads the ready-made prop
 * bag for a step rather than wiring `onNext` itself, which is what stops a new
 * theme from quietly skipping the Menu step or landing a map venue on Details
 * with no table chosen.
 */
export interface BookingFlow {
  slug: string;
  venue: PublicTenant;

  step: Step;
  state: BookingState;
  confirmation: PublicReservation | null;

  /** Venue capabilities, resolved once. */
  isSpa: boolean;
  hasMap: boolean;
  hasMenu: boolean;

  /** The rail this venue's stepper should show, in order. */
  goTo: (step: Step) => void;

  serviceProps: {
    slug: string;
    tenant: PublicTenant;
    state: BookingState;
    setState: React.Dispatch<React.SetStateAction<BookingState>>;
    onNext: () => void;
  };
  dateProps: {
    tenant: PublicTenant;
    state: BookingState;
    setState: React.Dispatch<React.SetStateAction<BookingState>>;
    onBack?: () => void;
    onNext: () => void;
  };
  slotProps: {
    slug: string;
    tenant: PublicTenant;
    state: BookingState;
    setState: React.Dispatch<React.SetStateAction<BookingState>>;
    onBack: () => void;
    onNext: () => void;
  };
  sectionProps: {
    slug: string;
    selectedId: string | null;
    /** The chosen slot, so the area cards are priced and filtered for it. */
    reservedAt: string | null;
    onSelect: (section: VenueMapSectionSummary) => void;
    onBack: () => void;
  };
  /**
   * Null until a section and a slot are both chosen — the spot step cannot be
   * asked for a floor plan without them, and a shell that renders it anyway
   * would send `reservedAt: undefined` to the availability query.
   */
  tableProps: {
    slug: string;
    sectionId: string;
    sectionName: string;
    reservedAt: string;
    partySize: number;
    selectedTableId: string | null;
    selectedCombinationId: string | null;
    onSelect: (table: VenueMapTable | null) => void;
    onSelectCombination: (combination: VenueMapCombination | null) => void;
    onBack: () => void;
    onNext: () => void;
  } | null;
  menuProps: {
    slug: string;
    lines: MenuOrderLine[];
    onChange: (lines: MenuOrderLine[]) => void;
    onBack: () => void;
    onNext: () => void;
  };
  detailsProps: {
    slug: string;
    tenant: PublicTenant;
    state: BookingState;
    setState: React.Dispatch<React.SetStateAction<BookingState>>;
    onBack: () => void;
    onSuccess: (reservation: PublicReservation) => void;
  };
}

export function useBookingFlow(slug: string, venue: PublicTenant): BookingFlow {
  const isSpa = venue.booking_strategy === "spa";
  // Map booking is restaurant-only and opt-in per venue. Everything below
  // falls back to the classic 4-step flow when it's off.
  const hasMap = !isSpa && venue.venue_map?.enabled === true;
  // Driven by the venue's menu mode, so a venue with no menu — or one switched
  // off — never gets a Menu step, empty or otherwise.
  const hasMenu = !isSpa && venue.menu?.visible === true;

  // `?date=YYYY-MM-DD` lands a guest here from an event page with that night
  // already chosen. Read once for the initial state rather than watched, so a
  // guest who then picks a different date isn't dragged back to it. Validated
  // against the shape and floored at today, since it arrives from the URL.
  const requestedDate = useSearchParams().get("date");
  const initialDate =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate >= todayISO()
      ? requestedDate
      : todayISO();

  const [step, setStep] = useState<Step>(isSpa ? "service" : "date");
  const [confirmation, setConfirmation] = useState<PublicReservation | null>(null);
  const [state, setState] = useState<BookingState>({
    service_id: null,
    therapist_id: null,
    date: initialDate,
    party_size: 2,
    slot: null,
    section_id: null,
    section_name: null,
    table_id: null,
    combination_id: null,
    menu_lines: [],
    guest: {
      name: "",
      email: "",
      phone: "",
      marketing_opt_in: false,
      birthday_month: null,
      birthday_day: null,
    },
    occasion: "",
    special_requests: "",
    custom_fields: {},
  });

  const goTo = useCallback((next: Step) => setStep(next), []);

  /** Where "continue" goes from the time step, given what this venue has. */
  const afterSlot: Step = hasMap ? "section" : hasMenu ? "menu" : "details";
  /** Where "back" goes from the details step — the mirror of the above. */
  const beforeDetails: Step = hasMenu ? "menu" : hasMap ? "table" : "slot";

  const tableProps = useMemo(() => {
    if (!hasMap || !state.section_id || !state.slot) return null;
    return {
      slug,
      sectionId: state.section_id,
      sectionName: state.section_name ?? "",
      reservedAt: state.slot.reserved_at_utc,
      partySize: state.party_size,
      selectedTableId: state.table_id,
      selectedCombinationId: state.combination_id,
      // A spot and a group are alternatives, so choosing either clears the
      // other — sending both is a 422.
      onSelect: (table: VenueMapTable | null) =>
        setState((s) => ({ ...s, table_id: table?.id ?? null, combination_id: null })),
      onSelectCombination: (combination: VenueMapCombination | null) =>
        setState((s) => ({
          ...s,
          combination_id: combination?.id ?? null,
          table_id: null,
        })),
      onBack: () => {
        setState((s) => ({ ...s, table_id: null, combination_id: null }));
        setStep("section");
      },
      onNext: () => setStep(hasMenu ? "menu" : "details"),
    };
  }, [
    hasMap,
    hasMenu,
    slug,
    state.section_id,
    state.section_name,
    state.slot,
    state.party_size,
    state.table_id,
    state.combination_id,
  ]);

  return {
    slug,
    venue,
    step,
    state,
    confirmation,
    isSpa,
    hasMap,
    hasMenu,
    goTo,

    serviceProps: {
      slug,
      tenant: venue,
      state,
      setState,
      onNext: () => setStep("date"),
    },
    dateProps: {
      tenant: venue,
      state,
      setState,
      onBack: isSpa ? () => setStep("service") : undefined,
      onNext: () => setStep("slot"),
    },
    slotProps: {
      slug,
      tenant: venue,
      state,
      setState,
      onBack: () => setStep("date"),
      onNext: () => setStep(afterSlot),
    },
    sectionProps: {
      slug,
      selectedId: state.section_id,
      // The chosen slot, so the area cards quote what this slot actually costs
      // — a period the venue set to 0% should not advertise a price.
      reservedAt: state.slot?.reserved_at_utc ?? null,
      onSelect: (section: VenueMapSectionSummary) => {
        // Changing area invalidates any spot chosen in the previous one.
        setState((s) => ({
          ...s,
          section_id: section.id,
          section_name: section.name,
          table_id: null,
          combination_id: null,
        }));
        setStep("table");
      },
      onBack: () => setStep("slot"),
    },
    tableProps,
    menuProps: {
      slug,
      lines: state.menu_lines,
      onChange: (menu_lines: MenuOrderLine[]) => setState((s) => ({ ...s, menu_lines })),
      onBack: () => setStep(hasMap ? "table" : "slot"),
      onNext: () => setStep("details"),
    },
    detailsProps: {
      slug,
      tenant: venue,
      state,
      setState,
      onBack: () => setStep(beforeDetails),
      onSuccess: (r: PublicReservation) => {
        setConfirmation(r);
        setStep("done");
      },
    },
  };
}
