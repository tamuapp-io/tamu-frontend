import { cn } from "@/lib/utils";
import type { ReservationStatus } from "@/lib/types";
import { statusClass, statusLabel } from "@/lib/format";

interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: ReservationStatus;
}

export function StatusPill({ status, className, ...props }: StatusPillProps) {
  return (
    <span className={cn("pill", statusClass(status), className)} {...props}>
      <span className="dot" aria-hidden />
      {statusLabel(status)}
    </span>
  );
}
