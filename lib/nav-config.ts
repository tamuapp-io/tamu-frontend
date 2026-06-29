import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarCheck,
  ChartLine,
  CircleUserRound,
  ClipboardList,
  Contact,
  Grid2x2,
  Home,
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

/**
 * The app is split into top-level sections (modules) the user picks from
 * the Home hub. Each section owns its own scoped sidebar — the sidebar a
 * page shows is decided by which section the current path belongs to
 * (see {@link getSectionForPath}).
 *
 * `match` lists the path prefixes that belong to the section. Prefixes are
 * compared longest-first so `/reports/events` resolves to Ticket even
 * though `/reports` belongs to Booking.
 */
export type AppSection = {
  id: "booking" | "ticket" | "crm";
  label: string;
  description: string;
  icon: LucideIcon;
  /** Landing route when the section is opened from Home. */
  home: string;
  /** Coming-soon sections render disabled on the Home hub. */
  disabled?: boolean;
  match: string[];
  groups: AppNavGroup[];
};

export const APP_SECTIONS: AppSection[] = [
  {
    id: "booking",
    label: "Booking",
    description: "Reservations, walk-ins, waitlist, tables, and the live floor.",
    icon: CalendarCheck,
    home: "/live",
    match: ["/live", "/reservations", "/walkins", "/waitlist", "/tables", "/guests", "/reports"],
    groups: [
      {
        label: "Operate",
        items: [
          { href: "/live", label: "Live service", icon: Activity, keywords: ["tonight", "floor"] },
          { href: "/reservations", label: "Reservations", icon: CalendarCheck, keywords: ["bookings"] },
          { href: "/walkins", label: "Walk-ins", icon: Users, keywords: ["walk in", "ledger"] },
          { href: "/waitlist", label: "Waitlist", icon: ClipboardList, keywords: ["queue"] },
        ],
      },
      {
        label: "Manage",
        items: [
          { href: "/tables", label: "Tables & Floor", icon: Grid2x2, keywords: ["floor plan", "layout"] },
          { href: "/guests", label: "Guests", icon: CircleUserRound, keywords: ["crm", "diners", "reservations"] },
          { href: "/reports", label: "Reports", icon: ChartLine, keywords: ["analytics", "reservations"] },
        ],
      },
    ],
  },
  {
    id: "ticket",
    label: "Ticket",
    description: "Events, attendees, check-in, and ticket sales.",
    icon: Ticket,
    home: "/events",
    // `/reports/events` is listed before `/reports` (Booking) wins it because
    // section resolution prefers the longest matching prefix.
    match: ["/events", "/reports/events"],
    groups: [
      {
        label: "Operate",
        items: [
          { href: "/events", label: "Events", icon: Ticket, keywords: ["tickets", "ticketing"] },
        ],
      },
      {
        label: "Manage",
        items: [
          { href: "/events/attendees", label: "Attendees", icon: Users, keywords: ["guests", "ticket buyers", "tickets"] },
          { href: "/reports/events", label: "Reports", icon: TicketCheck, keywords: ["analytics", "tickets", "sales"] },
        ],
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    description: "Unified guest profiles, segments, and campaigns.",
    icon: Contact,
    home: "#",
    disabled: true,
    match: [],
    groups: [],
  },
];

/**
 * Cross-section utilities surfaced everywhere via the top header (and the
 * command palette) rather than inside any one section's sidebar.
 */
export const GLOBAL_NAV_ITEMS: AppNavItem[] = [
  { href: "/home", label: "Home", icon: Home, keywords: ["modules", "menu", "dashboard", "sections"] },
  { href: "/messages", label: "WhatsApp Chat", icon: MessageCircle, keywords: ["chat", "inbox", "whatsapp", "messages"] },
  { href: "/settings", label: "Settings", icon: Settings, keywords: ["preferences", "config"] },
];

/** Returns true when `pathname` is at, or nested under, `prefix`. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Resolve which section a path belongs to. Returns null for section-less
 * pages (Home, WhatsApp, Settings), which render without a scoped sidebar.
 */
export function getSectionForPath(pathname: string): AppSection | null {
  let best: { section: AppSection; len: number } | null = null;

  for (const section of APP_SECTIONS) {
    for (const prefix of section.match) {
      if (matchesPrefix(pathname, prefix) && (!best || prefix.length > best.len)) {
        best = { section, len: prefix.length };
      }
    }
  }

  return best?.section ?? null;
}

/**
 * The most specific nav item href the current path maps to, used so only
 * one sidebar row highlights (e.g. `/events/attendees` highlights Attendees,
 * not Events).
 */
export function activeHrefForPath(items: AppNavItem[], pathname: string): string | null {
  let best: string | null = null;

  for (const item of items) {
    if (item.disabled) continue;
    if (matchesPrefix(pathname, item.href) && (!best || item.href.length > best.length)) {
      best = item.href;
    }
  }

  return best;
}
