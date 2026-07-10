import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarCheck,
  ChartLine,
  CircleUserRound,
  ClipboardList,
  Contact,
  DoorOpen,
  Grid2x2,
  Hand,
  Home,
  LayoutDashboard,
  Megaphone,
  MessageCircle,
  Plug,
  Repeat,
  Settings,
  Sparkles,
  Ticket,
  TicketCheck,
  Users,
} from "lucide-react";

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** If set, only tenants in one of these categories see this item. */
  categories?: string[];
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
  /** If set, only users with one of these roles may see/enter the section. */
  roles?: string[];
  /** If set, only tenants in one of these categories see this section. */
  categories?: string[];
  match: string[];
  groups: AppNavGroup[];
};

export const APP_SECTIONS: AppSection[] = [
  {
    id: "booking",
    label: "Booking",
    description: "Reservations, walk-ins, waitlist, tables or spa catalog, and live service.",
    icon: CalendarCheck,
    home: "/live",
    match: [
      "/live",
      "/reservations",
      "/walkins",
      "/waitlist",
      "/tables",
      "/services",
      "/therapists",
      "/rooms",
      "/guests",
      "/reports",
    ],
    groups: [
      {
        label: "Operate",
        items: [
          { href: "/live", label: "Live service", icon: Activity, categories: ["restaurant", "cafe"], keywords: ["tonight", "floor"] },
          { href: "/reservations", label: "Reservations", icon: CalendarCheck, keywords: ["bookings", "appointments"] },
          { href: "/walkins", label: "Walk-ins", icon: Users, categories: ["restaurant", "cafe"], keywords: ["walk in", "ledger"] },
          { href: "/waitlist", label: "Waitlist", icon: ClipboardList, keywords: ["queue"] },
        ],
      },
      {
        label: "Manage",
        items: [
          { href: "/tables", label: "Tables & Floor", icon: Grid2x2, categories: ["restaurant", "cafe"], keywords: ["floor plan", "layout"] },
          { href: "/services", label: "Services", icon: Sparkles, categories: ["spa", "wellness"], keywords: ["treatments", "packages", "catalog"] },
          { href: "/therapists", label: "Therapists", icon: Hand, categories: ["spa", "wellness"], keywords: ["practitioners", "staff"] },
          { href: "/rooms", label: "Rooms", icon: DoorOpen, categories: ["spa", "wellness"], keywords: ["treatment rooms"] },
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
    categories: ["restaurant", "cafe"],
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
    description: "Unified guest profiles, segments, and marketing sync.",
    icon: Contact,
    home: "/crm",
    roles: ["owner", "manager"],
    match: ["/crm"],
    groups: [
      {
        label: "Audience",
        items: [
          { href: "/crm", label: "Overview", icon: LayoutDashboard, keywords: ["dashboard", "crm", "segments"] },
          { href: "/crm/contacts", label: "Contacts", icon: Contact, keywords: ["customers", "guests", "marketing"] },
        ],
      },
      {
        label: "Marketing",
        items: [
          { href: "/crm/campaigns", label: "Campaigns", icon: Megaphone, keywords: ["whatsapp", "broadcast", "blast", "send"] },
          { href: "/crm/automations", label: "Automations", icon: Repeat, keywords: ["birthday", "win-back", "winback", "lifecycle"] },
          { href: "/crm/connections", label: "Integrations", icon: Plug, keywords: ["klaviyo", "mailchimp", "email", "sync"] },
        ],
      },
    ],
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

/** Whether a user with `role` may see/enter `section`. */
export function sectionAllowedForRole(section: AppSection, role?: string | null): boolean {
  if (!section.roles) return true;
  return role != null && section.roles.includes(role);
}

/** Whether a tenant in `category` sees this section. */
export function sectionAllowedForCategory(section: AppSection, category?: string | null): boolean {
  if (!section.categories) return true;
  return category != null && section.categories.includes(category);
}

/** Whether a tenant in `category` sees this nav item. */
export function navItemAllowedForCategory(item: AppNavItem, category?: string | null): boolean {
  if (!item.categories) return true;
  return category != null && item.categories.includes(category);
}

/**
 * The landing route for a section given the tenant's category — the first
 * item the category can actually see (so a spa's Booking section doesn't
 * land on the restaurant-only Live view). Falls back to `section.home`.
 */
export function sectionHomeForCategory(section: AppSection, category?: string | null): string {
  for (const group of section.groups) {
    for (const item of group.items) {
      if (!item.disabled && navItemAllowedForCategory(item, category)) {
        return item.href;
      }
    }
  }
  return section.home;
}

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
