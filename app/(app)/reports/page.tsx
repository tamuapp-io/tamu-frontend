"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { fetchReportSummary } from "@/lib/api/reports";
import { todayISO } from "@/lib/format";

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

  const counts = query.data?.counts;

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Reports", current: true }]}
      />
      <div className="grid gap-4 p-6">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">From</p>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">To</p>
            <Input type="date" value={toSel} onChange={(e) => setToSel(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              type="button"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Refresh
            </Button>
          </div>
        </div>

        {query.isPending && <Skeleton className="h-32 w-full" />}
        {query.isError && (
          <p className="text-sm text-destructive">
            {query.error instanceof ApiError ? query.error.message : "Failed to load"}
          </p>
        )}
        {counts && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Bookings (window)" value={counts.total} />
            <Stat label="Covers (completed)" value={counts.covers_completed} />
            <Stat label="No-shows" value={counts.no_show} />
            <Stat label="Repeat guest %" value={`${counts.repeat_guest_rate_percent}%`} />
          </div>
        )}
        {query.data && (
          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">By status</span>
            <pre className="mt-2 whitespace-pre-wrap">
              {JSON.stringify(query.data.by_status, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
