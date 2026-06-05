"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ExternalLink, Search } from "lucide-react";
import { TamuLogo } from "@/components/tamu-brand";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCommandPaletteStore } from "@/lib/store/command-palette-store";
import { useMobileSidebarStore } from "@/lib/store/mobile-sidebar-store";
import { useModKLabel } from "@/lib/hooks/use-mod-k-label";
import { initials } from "@/lib/format";
import { APP_NAV_GROUPS } from "@/lib/nav-config";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

function AppSidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);
  const openSearch = useCommandPaletteStore((s) => s.setOpen);
  const modK = useModKLabel();

  const afterInteract = () => {
    onNavigate?.();
  };

  return (
    <>
      <div className="mb-2 flex items-center gap-2 px-1 py-2">
        <TamuLogo height={20} className="min-w-0 shrink" />
        <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground">
          BETA
        </span>
      </div>

      <button
        type="button"
        onClick={() => {
          openSearch(true);
          afterInteract();
        }}
        aria-haspopup="dialog"
        aria-label={`Open search (${modK})`}
        className="flex h-9 items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        Search…
        <kbd className="ml-auto rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[11px] leading-none text-muted-foreground not-italic">
          {modK}
        </kbd>
      </button>

      {tenant?.slug ? (
        <Link
          href={`/book/${tenant.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={afterInteract}
          className="mt-2 flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          View booking page
        </Link>
      ) : null}

      {APP_NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-3">
          <div className="px-2 pb-1 label-cap">{group.label}</div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = !item.disabled && pathname.startsWith(item.href);
              const Icon = item.icon;

              if (item.disabled) {
                return (
                  <span
                    key={item.href}
                    aria-disabled
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground/70"
                    title="Coming in a later phase"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    <span className="ml-auto rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                      Soon
                    </span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={afterInteract}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-foreground text-primary-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mt-auto pt-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-100 text-xs font-semibold text-amber-900">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium">
              {user?.name ?? "—"} {tenant?.name ? `· ${tenant.name}` : ""}
            </div>
            <div className="text-[11px] capitalize text-muted-foreground">
              {user?.role ?? "Member"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const mobileOpen = useMobileSidebarStore((s) => s.open);
  const setMobileOpen = useMobileSidebarStore((s) => s.setOpen);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const closeWhenDesktop = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", closeWhenDesktop);
    closeWhenDesktop();
    return () => mq.removeEventListener("change", closeWhenDesktop);
  }, [setMobileOpen]);

  return (
    <>
      <aside className="hidden w-60 shrink-0 flex-col gap-1 border-r border-border bg-background p-4 lg:flex">
        <AppSidebarBody />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          id="mobile-app-sidebar"
          className="w-[min(280px,calc(100vw-3rem))] max-w-none border-r bg-background p-4 lg:hidden [&>button]:top-5"
          aria-describedby={undefined}
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-8 pt-12">
            <AppSidebarBody onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
