"use client";

import { StepMenu } from "@/components/menu-booking-step";
import { StepSection, StepTable } from "@/components/venue-map-booking-steps";
import { bookingCharge } from "@/lib/booking-charge";
import { StepDate, StepDetails, StepDone, StepService, StepSlot } from "../_steps";
import type { BookingFlow } from "../_use-booking-flow";
import type { Step } from "../_types";

/**
 * Renders whichever step the flow is on.
 *
 * Every shell goes through this rather than switching on `flow.step` itself,
 * so a step added later appears in all three themes at once.
 */
export function BookingStepsOutlet({
  flow,
  mapPortal,
}: {
  flow: BookingFlow;
  /**
   * Where the two map steps should draw the floor plan. Atlas passes its
   * full-screen region; the other themes pass nothing and the plan stays
   * inside the step's card. Either way the controls render here.
   */
  mapPortal?: Element | null;
}) {
  const at = (step: Step) => flow.step === step;

  // Read here rather than in the flow hook: how an amount is worded is a
  // presentation concern, and the flow has no opinion about money.
  const charge = bookingCharge(flow.venue.booking_charge);

  return (
    <>
      {at("service") && flow.isSpa && <StepService {...flow.serviceProps} />}
      {at("date") && <StepDate {...flow.dateProps} />}
      {at("slot") && <StepSlot {...flow.slotProps} />}
      {at("section") && flow.hasMap && (
        <StepSection {...flow.sectionProps} canvasPortal={mapPortal} />
      )}
      {at("table") && flow.tableProps && (
        <StepTable {...flow.tableProps} canvasPortal={mapPortal} charge={charge} />
      )}
      {at("menu") && flow.hasMenu && <StepMenu {...flow.menuProps} />}
      {at("details") && <StepDetails {...flow.detailsProps} />}
      {at("done") && flow.confirmation && (
        <StepDone confirmation={flow.confirmation} tenant={flow.venue} />
      )}
    </>
  );
}

/** The steps whose floor plan Atlas lifts onto its full-screen canvas. */
export const MAP_STEPS = ["section", "table"] as const satisfies readonly Step[];
