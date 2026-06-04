import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ReturningGuestBadgeProps = {
  totalBookings?: number | null;
  className?: string;
};

/** Shows a returning-guest chip when the guest has more than one booking. */
export function ReturningGuestBadge({
  totalBookings,
  className,
}: ReturningGuestBadgeProps) {
  const count = totalBookings ?? 0;
  if (count <= 1) return null;

  return (
    <Badge
      variant="accent"
      className={cn("text-[11px] font-medium", className)}
      title={`${count} bookings on file`}
    >
      Returning · {count}
    </Badge>
  );
}

export function guestBookingLabel(totalBookings?: number | null): string {
  const count = totalBookings ?? 0;
  if (count === 0) return "No bookings yet";
  if (count === 1) return "1 booking";
  return `${count} bookings`;
}

export function isReturningGuest(totalBookings?: number | null): boolean {
  return (totalBookings ?? 0) > 1;
}
