"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppTopbar } from "@/components/app-topbar";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { useEventReportSummary } from "@/lib/hooks/use-events";
import { formatMoney } from "@/lib/format";
import type { EventReportSummary } from "@/lib/types";

const SOURCE_COLORS = ["#a87d52", "#c2935e", "#d6b98a", "#8a6f58", "#b58b5c", "#e5c99a"];

export default function EventReportsPage() {
  const report = useEventReportSummary();

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Event reports", current: true }]}
      />
      <div className="space-y-6 p-6">
        {report.isPending && <Skeleton className="h-64 w-full" />}
        {report.isError && (
          <p className="text-sm text-destructive">
            {report.error instanceof ApiError ? report.error.message : "Failed to load report."}
          </p>
        )}
        {report.data && <SummaryBody data={report.data} />}
      </div>
    </>
  );
}

function SummaryBody({ data }: { data: EventReportSummary }) {
  const t = data.totals;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Stat label="Events" value={t.events} hint={`${t.published_events} published`} />
        <Stat label="Tickets sold" value={t.tickets_sold} />
        <Stat label="Revenue" value={formatMoney(t.revenue_cents)} />
        <Stat label="Checked in" value={t.checked_in} />
        <Stat label="No-show" value={t.no_show} />
        <Stat label="Unique buyers" value={t.unique_buyers} />
        <Stat label="Referral visitors" value={t.visitors} />
      </div>

      <ChartCard title="Tickets sold over time" subtitle="Daily ticket sales across all events.">
        <SeriesChart data={data.sales_series} color="#a87d52" name="Tickets" />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Sales by source" subtitle="Attribution across every event.">
          <SourceChart data={data.by_source} />
        </ChartCard>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold">Top referral links</h3>
          {data.top_referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referral links yet.</p>
          ) : (
            <Table
              head={["Source", "Clicks", "Orders", "Conv.", "Revenue"]}
              rows={data.top_referrals.map((r) => [
                r.label ?? r.code,
                r.clicks,
                r.orders_count,
                `${r.conversion_percent}%`,
                formatMoney(r.revenue_cents),
              ])}
            />
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Per-event performance</h3>
        {data.by_event.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Event</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Sold</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Checked in</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Revenue</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data.by_event.map((e) => (
                  <tr key={e.event_id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{e.name}</td>
                    <td className="py-2 pr-4 capitalize text-muted-foreground">{e.status}</td>
                    <td className="py-2 pr-4 tabular-nums">{e.tickets_sold}</td>
                    <td className="py-2 pr-4 tabular-nums">{e.checked_in}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatMoney(e.revenue_cents)}</td>
                    <td className="py-2 pr-4 text-right">
                      <Link
                        href={`/events/${e.event_id}/analytics`}
                        className="text-xs font-medium text-foreground underline-offset-2 hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </header>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

function SeriesChart({
  data,
  color,
  name,
}: {
  data: EventReportSummary["sales_series"];
  color: string;
  name: string;
}) {
  if (data.length === 0) return <EmptyChart label="No sales yet." />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.4} />
            <stop offset="95%" stopColor={color} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
        <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
        <Area type="monotone" dataKey="count" name={name} stroke={color} fill="url(#salesFill)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SourceChart({ data }: { data: EventReportSummary["by_source"] }) {
  const rows = data.filter((d) => d.tickets > 0);
  if (rows.length === 0) return <EmptyChart label="No sales yet." />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          formatter={(value, _n, item) => [value, String(item.payload.source)]}
        />
        <Pie data={rows} dataKey="tickets" nameKey="source" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
          {rows.map((row, i) => (
            <Cell key={row.source} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-4 font-medium ${i > 0 ? "tabular-nums" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/60 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className={`py-2 pr-4 ${ci > 0 ? "tabular-nums" : "font-medium"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
      {label}
    </div>
  );
}
