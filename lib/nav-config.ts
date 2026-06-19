import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Calendar,
  ChartLine,
  CircleUserRound,
  ClipboardList,
  Grid2x2,
  MessageCircle,
  Settings,
  Ticket,
  TicketCheck,
  Users,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Shown in command palette / search only */
  keywords?: string[];
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export const APP_NAV_GROUPS: AppNavGroup[] = [
  {
    label: "Operate",
    items: [
      { href: "/live", label: "Live service", icon: Activity, keywords: ["tonight", "floor"] },
      { href: "/reservations", label: "Reservations", icon: Calendar, keywords: ["bookings"] },
      { href: "/walkins", label: "Walk-ins", icon: Users, keywords: ["walk in", "ledger"] },
      { href: "/waitlist", label: "Waitlist", icon: ClipboardList, keywords: ["queue"] },
      { href: "/events", label: "Events", icon: Ticket, keywords: ["tickets", "ticketing"] },
      { href: "/messages", label: "WhatsApp", icon: MessageCircle, keywords: ["chat", "inbox"] },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/tables", label: "Tables & Floor", icon: Grid2x2, keywords: ["floor plan", "layout"] },
      { href: "/guests", label: "Booking guests", icon: CircleUserRound, keywords: ["crm", "diners", "reservations"] },
      { href: "/events/attendees", label: "Event guests", icon: Users, keywords: ["attendees", "ticket buyers", "tickets"] },
      { href: "/reports", label: "Booking reports", icon: ChartLine, keywords: ["analytics", "reservations"] },
      { href: "/reports/events", label: "Event reports", icon: TicketCheck, keywords: ["analytics", "tickets", "sales"] },
      { href: "/settings", label: "Settings", icon: Settings, keywords: ["preferences"] },
    ],
  },
];
