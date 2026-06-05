"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Bell, Calendar, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatChatListTime } from "@/lib/format";
import { useTenantTimezone } from "@/lib/hooks/use-tenant-timezone";
import { useBookingNotificationStore } from "@/lib/store/booking-notification-store";
import {
  staffNotificationUnreadCount,
  useStaffNotificationStore,
  type StaffNotification,
} from "@/lib/store/staff-notification-store";
import { cn } from "@/lib/utils";

function NotificationIcon({ kind }: { kind: StaffNotification["kind"] }) {
  if (kind === "whatsapp") {
    return <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  }

  return <Calendar className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />;
}

export function AppNotificationsMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const timezone = useTenantTimezone();
  const items = useStaffNotificationStore((s) => s.items);
  const markRead = useStaffNotificationStore((s) => s.markRead);
  const markAllRead = useStaffNotificationStore((s) => s.markAllRead);
  const markKindRead = useStaffNotificationStore((s) => s.markKindRead);
  const clearNewBooking = useBookingNotificationStore((s) => s.clearNewBooking);
  const unreadCount = staffNotificationUnreadCount(items);

  useEffect(() => {
    if (pathname.startsWith("/live") || pathname.startsWith("/reservations")) {
      markKindRead("booking");
      clearNewBooking();
    }

    if (pathname.startsWith("/messages")) {
      markKindRead("whatsapp");
    }
  }, [pathname, markKindRead, clearNewBooking]);

  function openNotification(item: StaffNotification) {
    markRead(item.id);
    router.push(item.href);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative shrink-0"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
        >
          <Bell className="h-4 w-4" aria-hidden />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Notifications
          </DropdownMenuLabel>
          {unreadCount > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              onClick={markAllRead}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No notifications yet.
          </div>
        ) : (
          <div className="max-h-[min(24rem,60vh)] overflow-y-auto py-1">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className={cn(
                  "cursor-pointer items-start gap-3 rounded-none px-3 py-2.5",
                  !item.read && "bg-muted/50",
                )}
                onSelect={() => openNotification(item)}
              >
                <NotificationIcon kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {formatChatListTime(item.createdAt, timezone)}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {item.body}
                  </p>
                </div>
                {!item.read ? (
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600"
                    aria-hidden
                  />
                ) : null}
              </DropdownMenuItem>
            ))}
          </div>
        )}
        <DropdownMenuSeparator className="m-0" />
        <div className="grid grid-cols-2 gap-1 p-1">
          <DropdownMenuItem asChild className="justify-center text-xs">
            <Link href="/live">Live service</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="justify-center text-xs">
            <Link href="/messages">WhatsApp</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
