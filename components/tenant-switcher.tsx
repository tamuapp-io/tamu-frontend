"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useSwitchTenant } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

/**
 * Venue picker for accounts attached to more than one venue.
 *
 * Renders nothing for the single-venue majority — a dropdown with one option
 * is just noise.
 */
export function TenantSwitcher() {
  const tenant = useAuthStore((s) => s.tenant);
  const tenants = useAuthStore((s) => s.tenants);
  const switchTenant = useSwitchTenant();
  const router = useRouter();

  if (tenants.length < 2) {
    return null;
  }

  const handleSelect = async (tenantId: string) => {
    if (tenantId === tenant?.id || switchTenant.isPending) return;

    try {
      const next = await switchTenant.mutateAsync(tenantId);
      toast.success(`Switched to ${next.tenant?.name ?? "venue"}`);
      // Land somewhere every role can see: permissions differ per venue, so the
      // current page may not be allowed at the venue we just moved to.
      router.push("/home");
    } catch (err) {
      toast.error(
        "Could not switch venue",
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switchTenant.isPending}
          className="inline-flex h-9 max-w-[190px] items-center gap-2 rounded-lg border border-border px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
          aria-label="Switch venue"
        >
          {switchTenant.isPending ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          <span className="truncate">{tenant?.name ?? "Select venue"}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Your venues
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => {
          const active = t.id === tenant?.id;
          return (
            <DropdownMenuItem
              key={t.id}
              onSelect={() => void handleSelect(t.id)}
              className={cn(active && "bg-muted")}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{t.name}</span>
                {t.role && (
                  <span className="text-[11px] capitalize text-muted-foreground">
                    {t.role}
                  </span>
                )}
              </div>
              {active && <Check className="h-4 w-4 shrink-0" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
