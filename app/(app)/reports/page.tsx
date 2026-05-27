"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { fetchReportSummary } from "@/lib/api/reports";
import { statusLabel, todayISO } from "@/lib/format";
import type { ReportDailyRow, ReportSummary } from "@/lib/types";

/**
 * Status palette pulled from the cream/coffee theme defined in globals.css.
 * Recharts can't read CSS vars directly (it injects `<svg>` attributes),
 * so we mirror the literal hex values used by `.pill.<status>` here. Keep
 * these in sync if the theme variables move.
 */
const STATUS_COLORS: Record<string, { fill: string; stroke: string }> = {
  pending: { fill: "#f3e2c2", stroke: "#c99358" },
  confirmed: { fill: "#ecd9b6", stroke: "#b58b5c" },
  seated: { fill: "#e5c99a", stroke: "#c2935e" },
  completed: { fill: "#e8ddc9", stroke: "#8a6f58" },
  cancelled: { fill: "#ece3d5", stroke: "#b0a091" },
  no_show: { fill: "#f0d4c5", stroke: "#b25d40" },
  waitlisted: { fill: "#ecddc0", stroke: "#a87d52" },
};

const STATUS_ORDER_FOR_STACK: Array<keyof ReportDailyRow> = [
  "completed",
  "seated",
  "confirmed",
  "pending",
  "waitlisted",
  "cancelled",
  "no_show",
];

export default function ReportsPage() {
  const to = todayISO();
  const fromDefault = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(fromDefault);
  const [toSel, setToSel] = useState(to);

  const query = useQuery({
    queryKey: ["reports", from, toSel],
    queryFn: async () =>
      fetchReportSummary({ from, to: toSel }).then((res) => res.data),
    enabled: Boolean(from && toSel),
  });

  const summary: ReportSummary | undefined = query.data;
  const counts = summary?.counts;

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Reports", current: true }]}
      />
      <div className="grid gap-6 p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              From
            </p>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              To
            </p>
            <Input
              type="date"
              value={toSel}
              onChange={(e) => setToSel(e.target.value)}
              className="w-44"
            />
          </div>
          <Button
            variant="outline"
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
          {summary?.timezone && (
            <p className="ml-auto text-xs text-muted-foreground">
              Window in <span className="font-medium">{summary.timezone}</span>
            </p>
          )}
        </div>

        {query.isPending && <Skeleton className="h-64 w-full" />}
        {query.isError && (
          <p className="text-sm text-destructive">
            {query.error instanceof ApiError ? query.error.message : "Failed to load"}
          </p>
        )}

        {summary && counts && (
          <>
            {/* KPI tiles */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Bookings (window)" value={counts.total} />
              <Stat label="Covers (completed)" value={counts.covers_completed} />
              <Stat label="No-shows" value={counts.no_show} />
              <Stat
                label="Repeat guest rate"
                value={`${counts.repeat_guest_rate_percent}%`}
              />
            </div>

            {/* Daily trend */}
            <ChartCard
              title="Bookings over time"
              subtitle="Daily reservation count, stacked by status."
            >
              <BookingsTrendChart data={summary.by_day} />
            </ChartCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <ChartCard
                title="Status mix"
                subtitle="Where reservations ended up across the window."
              >
                <StatusDonut byStatus={summary.by_status} />
              </ChartCard>

              <ChartCard
                title="Party-size distribution"
                subtitle="How many reservations of each size landed in the window."
              >
                <PartySizeChart data={summary.by_party_size} />
              </ChartCard>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
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
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </header>
      <div className="h-64 w-full">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Chart components                                                          */
/* -------------------------------------------------------------------------- */

function BookingsTrendChart({ data }: { data: ReportDailyRow[] }) {
  // Empty/all-zero series: show a polite empty state instead of an empty axis.
  const total = data.reduce((sum, row) => sum + row.total, 0);
  if (data.length === 0 || total === 0) {
    return <EmptyChart label="No bookings in this window yet." />;
  }

  const chartData = data.map((row) => ({
    ...row,
    label: formatShortDay(row.date),
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          {STATUS_ORDER_FOR_STACK.map((status) => {
            const color = STATUS_COLORS[status as string];
            if (!color) return null;
            return (
              <linearGradient
                key={status}
                id={`fill-${status}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color.stroke} stopOpacity={0.45} />
                <stop offset="95%" stopColor={color.stroke} stopOpacity={0.08} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
          formatter={(value, name) => [value, statusLabel(String(name))]}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          formatter={(value) => statusLabel(String(value))}
        />
        {STATUS_ORDER_FOR_STACK.map((status) => {
          const color = STATUS_COLORS[status as string];
          if (!color) return null;
          return (
            <Area
              key={status}
              type="monotone"
              dataKey={status as string}
              stackId="status"
              stroke={color.stroke}
              fill={`url(#fill-${status})`}
              strokeWidth={1.5}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatusDonut({ byStatus }: { byStatus: Record<string, number> }) {
  const rows = Object.entries(byStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({ status, count }));

  if (rows.length === 0) {
    return <EmptyChart label="No reservations to break down." />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value, _name, item) => [
            value,
            statusLabel(String(item.payload.status)),
          ]}
        />
        <Pie
          data={rows}
          dataKey="count"
          nameKey="status"
          innerRadius="55%"
          outerRadius="85%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {rows.map((row) => {
            const color = STATUS_COLORS[row.status]?.stroke ?? "#8a6f58";
            return <Cell key={row.status} fill={color} />;
          })}
        </Pie>
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          iconType="circle"
          formatter={(value) => statusLabel(String(value))}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function PartySizeChart({
  data,
}: {
  data: { party_size: number; count: number }[];
}) {
  if (data.length === 0) {
    return <EmptyChart label="No party-size data yet." />;
  }

  const chartData = data.map((row) => ({
    label: `${row.party_size}`,
    count: row.count,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={{ stroke: "rgba(0,0,0,0.08)" }}
          label={{
            value: "Party size",
            position: "insideBottom",
            offset: -4,
            style: { fontSize: 11, fill: "var(--muted-foreground)" },
          }}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickLine={false}
          axisLine={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => [value, "Reservations"]}
          labelFormatter={(label) => `Party of ${label}`}
        />
        <Bar
          dataKey="count"
          fill="#d6b98a"
          stroke="#a87d52"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
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

/** "May 03" — terse axis label that survives ~30 ticks. */
function formatShortDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return ymd;
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}
