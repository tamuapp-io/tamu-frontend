"use client";

import { useRouter } from "next/navigation";
import { LogOut, Plus, User } from "lucide-react";
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
import { initials } from "@/lib/format";

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
  const logout = useLogout();
  const router = useRouter();

  const handleLogout = async () => {
    await logout.mutateAsync();
    router.replace("/login");
  };

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.label} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">/</span>}
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
