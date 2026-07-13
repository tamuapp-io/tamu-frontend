"use client";

import { cn } from "@/lib/utils";
import type { ReservationStatus } from "@/lib/types";
import { statusClass, statusLabel } from "@/lib/format";
import { useCategory } from "@/lib/hooks/use-category";

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ReservationStatus;
}

export function StatusPill({ status, className, ...props }: StatusPillProps) {
  // Spa/wellness tenants read "seated" as "In use".
  const { isSpa } = useCategory();

  return (
    <span className={cn("pill", statusClass(status), className)} {...props}>
      <span className="dot" aria-hidden />
      {statusLabel(status, isSpa)}
    </span>
  );
}
