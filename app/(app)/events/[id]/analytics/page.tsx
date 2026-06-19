"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { useEventReport } from "@/lib/hooks/use-events";
import { formatMoney } from "@/lib/format";
import type { EventReport } from "@/lib/types";

const SOURCE_COLORS = ["#a87d52", "#c2935e", "#d6b98a", "#8a6f58", "#b58b5c", "#e5c99a"];

export default function EventAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const report = useEventReport(id);

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Events" },
          { label: "Analytics", current: true },
        ]}
      />
      <div className="space-y-6 p-6">
        <Link
          href={`/events/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back to event
        </Link>

        {report.isPending && <Skeleton className="h-64 w-full" />}
        {report.isError && (
          <p className="text-sm text-destructive">
            {report.error instanceof ApiError ? report.error.message : "Failed to load report."}
          </p>
        )}

        {report.data && <ReportBody report={report.data} />}
      </div>
    </>
  );
}

function ReportBody({ report }: { report: EventReport }) {
  const t = report.totals;
  const currency = "IDR";

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Stat label="Tickets sold" value={t.tickets_sold} />
        <Stat label="Revenue" value={formatMoney(t.revenue_cents, currency)} />
        <Stat label="Checked in" value={t.checked_in} />
        <Stat label="No-show" value={t.no_show} />
        <Stat label="Check-in rate" value={`${t.check_in_rate_percent}%`} />
        <Stat label="Unique buyers" value={t.unique_buyers} />
        <Stat
          label="Sell-through"
          value={t.sell_through_percent != null ? `${t.sell_through_percent}%` : "—"}
          hint={t.capacity != null ? `of ${t.capacity} cap` : "unlimited"}
        />
        <Stat label="Avg / order" value={t.avg_tickets_per_order} />
        <Stat label="Referral visitors" value={t.visitors} />
        <Stat
          label="Visitor conv."
          value={t.visitor_conversion_percent != null ? `${t.visitor_conversion_percent}%` : "—"}
        />
      </div>

      <ChartCard title="Tickets sold over time" subtitle="Daily sales by order date.">
        <SalesChart data={report.sales_series} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Sales by ticket type" subtitle="Tickets sold per variation.">
          <ByTypeChart data={report.by_type} />
        </ChartCard>
        <ChartCard title="Sales by source" subtitle="Where orders came from.">
          <BySourceChart data={report.by_source} />
        </ChartCard>
      </div>

      <ChartCard title="Check-ins over time" subtitle="Daily admissions at the door.">
        <CheckInChart data={report.check_in_series} />
      </ChartCard>

      <section className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Referral performance</h3>
        {report.referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referral links for this event.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Clicks</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Orders</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Conversion</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {report.referrals.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.label ?? r.code}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.clicks}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.orders_count}</td>
                    <td className="py-2 pr-4 tabular-nums">{r.conversion_percent}%</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {formatMoney(r.revenue_cents, currency)}
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

function ByTypeChart({ data }: { data: EventReport["by_type"] }) {
  if (data.length === 0) return <EmptyChart label="No ticket types yet." />;
  const chartData = data.map((d) => ({ label: d.name, sold: d.sold, checked_in: d.checked_in }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        <Bar dataKey="sold" name="Sold" fill="#d6b98a" stroke="#a87d52" radius={[4, 4, 0, 0]} />
        <Bar dataKey="checked_in" name="Checked in" fill="#bfe3c8" stroke="#4b9460" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function BySourceChart({ data }: { data: EventReport["by_source"] }) {
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

function SalesChart({ data }: { data: EventReport["sales_series"] }) {
  if (data.length === 0) return <EmptyChart label="No sales recorded yet." />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a87d52" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#a87d52" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="count" name="Tickets" stroke="#a87d52" fill="url(#salesFill)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CheckInChart({ data }: { data: EventReport["check_in_series"] }) {
  if (data.length === 0) return <EmptyChart label="No check-ins recorded yet." />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="checkinFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4b9460" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#4b9460" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="count" name="Check-ins" stroke="#4b9460" fill="url(#checkinFill)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
      {label}
    </div>
  );
}
