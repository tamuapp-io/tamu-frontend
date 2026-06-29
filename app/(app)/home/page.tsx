"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { useAuthStore } from "@/lib/store/auth-store";
import { APP_SECTIONS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

export default function HomeHubPage() {
  const user = useAuthStore((s) => s.user);
  const tenant = useAuthStore((s) => s.tenant);

  const firstName = user?.name?.split(" ")[0];

  return (
    <>
      <AppTopbar breadcrumbs={[]} />

      <div className="mx-auto w-full max-w-5xl space-y-8 p-6 sm:p-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant?.name ? `${tenant.name} · ` : ""}Choose where you want to work today.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {APP_SECTIONS.map((section) => {
            const Icon = section.icon;

            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-muted/50 text-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  {section.disabled ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Coming soon
                    </span>
                  ) : (
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-base font-semibold text-foreground">{section.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                </div>
              </>
            );

            const cardClass = cn(
              "group flex flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-colors",
              section.disabled
                ? "cursor-not-allowed opacity-60"
                : "hover:border-foreground/20 hover:bg-muted/30",
            );

            if (section.disabled) {
              return (
                <div key={section.id} aria-disabled className={cardClass} title="Coming soon">
                  {inner}
                </div>
              );
            }

            return (
              <Link key={section.id} href={section.home} className={cardClass}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
