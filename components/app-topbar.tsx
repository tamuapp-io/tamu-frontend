"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, MessageCircle, Plus, Settings as SettingsIcon, User, X } from "lucide-react";
import { AppNotificationsMenu } from "@/components/app-notifications-menu";
import { TamuLogo } from "@/components/tamu-brand";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth-store";
import { useMobileSidebarStore } from "@/lib/store/mobile-sidebar-store";
import { useWhatsappHasUnread } from "@/lib/hooks/use-whatsapp-inbox";
import { getSectionForPath } from "@/lib/nav-config";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AppTopbarProps {
  breadcrumbs: Array<{ label: string; current?: boolean }>;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
}

export function AppTopbar({ breadcrumbs, primaryAction }: AppTopbarProps) {
  const user = useAuthStore((s) => s.user);
  const mobileSidebarOpen = useMobileSidebarStore((s) => s.open);
  const toggleMobileSidebar = useMobileSidebarStore((s) => s.toggle);
  const logout = useLogout();
  const router = useRouter();
  const pathname = usePathname();
  const { hasUnread: whatsappUnread } = useWhatsappHasUnread();

  // The mobile menu only exists where a scoped sidebar is rendered.
  const hasSectionSidebar = getSectionForPath(pathname) !== null;
  const onHome = pathname === "/home";
  const onWhatsapp = pathname.startsWith("/messages");
  const onSettings = pathname.startsWith("/settings");

  const handleLogout = async () => {
    await logout.mutateAsync();
    router.replace("/login");
  };

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-background px-4 sm:gap-3 sm:px-6">
      {hasSectionSidebar && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            "shrink-0 transition-[box-shadow,background-color] lg:hidden",
            mobileSidebarOpen && "border-foreground/20 bg-muted",
          )}
          aria-label={mobileSidebarOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileSidebarOpen}
          aria-controls="mobile-app-sidebar"
          onClick={() => toggleMobileSidebar()}
        >
          {mobileSidebarOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </Button>
      )}
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm"
      >
        <Link
          href="/home"
          aria-label="Tamu — Home"
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          {onHome ? <TamuLogo height={20} /> : "Home"}
        </Link>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.label} className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <span
              className={
                crumb.current
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              }
              aria-current={crumb.current ? "page" : undefined}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <TenantSwitcher />

        <Link
          href="/messages"
          aria-label="WhatsApp Chat"
          className={cn(
            "relative inline-flex h-9 items-center gap-2 rounded-lg border border-border px-2.5 text-[13px] font-medium transition-colors hover:bg-muted",
            onWhatsapp ? "bg-muted text-foreground" : "text-foreground",
          )}
        >
          <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden sm:inline">WhatsApp Chat</span>
          {whatsappUnread ? (
            <span
              className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-red-600"
              aria-hidden
            />
          ) : null}
        </Link>

        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-lg border border-border px-2.5 text-[13px] font-medium transition-colors hover:bg-muted",
            onSettings ? "bg-muted text-foreground" : "text-foreground",
          )}
        >
          <SettingsIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="hidden sm:inline">Settings</span>
        </Link>

        <AppNotificationsMenu />

        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[12px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
          title="Realtime updates land in Phase 2"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
          Live
        </span>

        {primaryAction && (
          <Button onClick={primaryAction.onClick} size="md">
            {primaryAction.icon ?? <Plus className="h-4 w-4" />}
            {primaryAction.label}
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900 hover:bg-amber-200"
              aria-label="Account menu"
            >
              {initials(user?.name)}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium text-foreground">
                {user?.name ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {user?.email ?? ""}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <User className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
