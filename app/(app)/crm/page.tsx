"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Megaphone, Plug, Users } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { fetchCrmOverview } from "@/lib/api/crm";
import type { CrmConnection } from "@/lib/types";

const PROVIDER_LABELS: Record<string, string> = {
  klaviyo: "Klaviyo",
  mailchimp: "Mailchimp",
};

export default function CrmOverviewPage() {
  const overview = useQuery({
    queryKey: ["crm-overview"],
    queryFn: () => fetchCrmOverview().then((r) => r.data),
  });

  const data = overview.data;

  const statCards = data
    ? [
        { label: "Contacts", value: data.stats.contacts },
        { label: "WhatsApp opt-in", value: data.stats.whatsapp_consented },
        { label: "Email opt-in", value: data.stats.email_consented },
        { label: "Regulars", value: data.stats.regulars },
        { label: "Lapsed", value: data.stats.lapsed },
        { label: "Birthdays this month", value: data.stats.birthdays_this_month },
      ]
    : [];

  const connections: CrmConnection[] = data
    ? [data.connections.klaviyo, data.connections.mailchimp]
    : [];

  return (
    <>
      <AppTopbar breadcrumbs={[{ label: "CRM" }, { label: "Overview", current: true }]} />

      <div className="space-y-6 p-6">
        {overview.isError && (
          <p className="text-sm text-destructive">
            {overview.error instanceof ApiError ? overview.error.message : "Failed to load CRM."}
          </p>
        )}

        {/* Stat tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {overview.isPending
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
            : statCards.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4">
                  <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
        </div>

        {/* Segments */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Segments</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.isPending
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
              : data?.segments.map((seg) => (
                  <Link
                    key={seg.key}
                    href={`/crm/contacts?segment=${seg.key}`}
                    className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{seg.label}</span>
                      <Badge variant="muted">{seg.count}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{seg.description}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      View contacts
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
          </div>
        </section>

        {/* Campaigns CTA */}
        {!overview.isPending && (
          <Link
            href="/crm/campaigns"
            className="group flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-foreground">
                <Megaphone className="h-5 w-5" />
              </span>
              <div>
                <div className="font-medium">WhatsApp campaigns</div>
                <div className="text-xs text-muted-foreground">
                  Broadcast to a segment — birthdays, win-backs, announcements.
                </div>
              </div>
            </div>
            {data && !data.channels.whatsapp_ready ? (
              <Badge variant="warning">Connect WhatsApp</Badge>
            ) : (
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            )}
          </Link>
        )}

        {/* Connections */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Marketing integrations</h2>
            </div>
            <Link href="/crm/connections" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Manage
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.isPending
              ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
              : connections.map((conn) => (
                  <Link
                    key={conn.provider}
                    href="/crm/connections"
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-muted/30"
                  >
                    <div>
                      <div className="font-medium">{PROVIDER_LABELS[conn.provider] ?? conn.provider}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {conn.configured
                          ? conn.account_label ?? "Connected"
                          : "Not connected"}
                      </div>
                    </div>
                    <Badge variant={conn.configured ? "accent" : "muted"}>
                      {conn.configured ? "Connected" : "Off"}
                    </Badge>
                  </Link>
                ))}
          </div>
        </section>
      </div>
    </>
  );
}
