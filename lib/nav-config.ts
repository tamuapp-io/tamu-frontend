import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Calendar,
  ChartLine,
  CircleUserRound,
  ClipboardList,
  Grid2x2,
  Settings,
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
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/tables", label: "Tables & Floor", icon: Grid2x2, keywords: ["floor plan", "layout"] },
      { href: "/guests", label: "Guests", icon: CircleUserRound, keywords: ["crm"] },
      { href: "/reports", label: "Reports", icon: ChartLine, keywords: ["analytics"] },
      { href: "/settings", label: "Settings", icon: Settings, keywords: ["preferences"] },
    ],
  },
];
