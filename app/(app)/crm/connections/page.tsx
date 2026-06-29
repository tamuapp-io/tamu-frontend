"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plug, RefreshCw } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import {
  connectCrmProvider,
  disconnectCrmProvider,
  fetchCrmAudiences,
  fetchCrmConnections,
  fetchCrmOverview,
  syncCrmProvider,
} from "@/lib/api/crm";
import type { CrmConnection, CrmProviderKey, CrmSegment } from "@/lib/types";

const PROVIDER_META: Record<
  CrmProviderKey,
  { name: string; blurb: string; keyLabel: string; keyHint: string; listLabel: string; listRequired: boolean }
> = {
  klaviyo: {
    name: "Klaviyo",
    blurb: "Push guests as Klaviyo profiles and optionally add them to a list.",
    keyLabel: "Private API Key",
    keyHint: 'Klaviyo → Settings → API keys. Starts with "pk_".',
    listLabel: "List (optional)",
    listRequired: false,
  },
  mailchimp: {
    name: "Mailchimp",
    blurb: "Sync guests into a Mailchimp audience as subscribed members.",
    keyLabel: "API Key",
    keyHint: 'Account → Extras → API keys. Ends with a datacenter like "-us21".',
    listLabel: "Audience",
    listRequired: true,
  },
};

function ProviderCard({
  provider,
  connection,
  segments,
}: {
  provider: CrmProviderKey;
  connection: CrmConnection;
  segments: CrmSegment[];
}) {
  const qc = useQueryClient();
  const meta = PROVIDER_META[provider];

  const [apiKey, setApiKey] = useState("");
  const [listId, setListId] = useState(connection.list_id ?? "");
  const [segment, setSegment] = useState("all");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["crm-connections"] });
    qc.invalidateQueries({ queryKey: ["crm-overview"] });
  };

  const audiences = useQuery({
    queryKey: ["crm-audiences", provider],
    queryFn: () => fetchCrmAudiences(provider).then((r) => r.data),
    enabled: connection.configured,
    staleTime: 60_000,
  });

  const connect = useMutation({
    mutationFn: () => connectCrmProvider(provider, { api_key: apiKey.trim() }),
    onSuccess: () => {
      setApiKey("");
      toast.success(`${meta.name} connected`);
      invalidate();
    },
    onError: (e) =>
      toast.error("Could not connect", e instanceof ApiError ? e.message : undefined),
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectCrmProvider(provider),
    onSuccess: () => {
      toast.success(`${meta.name} disconnected`);
      invalidate();
    },
  });

  const sync = useMutation({
    mutationFn: () =>
      syncCrmProvider(provider, {
        segment,
        list_id: listId || undefined,
      }),
    onSuccess: (r) => {
      const last = r.data.last_sync;
      if (last?.status === "failed") {
        toast.error("Sync failed", last.message ?? undefined);
      } else {
        toast.success("Sync complete", last?.message ?? undefined);
      }
      invalidate();
    },
    onError: (e) => toast.error("Sync failed", e instanceof ApiError ? e.message : undefined),
  });

  const last = connection.last_sync;
  const syncDisabled = sync.isPending || (meta.listRequired && !listId);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{meta.name}</h3>
            {connection.configured ? (
              <Badge variant="accent">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="muted">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{meta.blurb}</p>
        </div>
      </div>

      {!connection.configured ? (
        <div className="mt-4 space-y-2">
          <Label htmlFor={`${provider}-key`}>{meta.keyLabel}</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={`${provider}-key`}
              type="password"
              autoComplete="off"
              className="max-w-md flex-1"
              placeholder={meta.keyLabel}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <Button
              onClick={() => connect.mutate()}
              disabled={connect.isPending || apiKey.trim().length < 8}
            >
              {connect.isPending ? "Connecting…" : "Connect"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{meta.keyHint}</p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Account: <span className="text-foreground">{connection.account_label ?? "—"}</span>
            </span>
            <span className="text-muted-foreground">
              Key: <span className="font-mono text-foreground">{connection.api_key_hint}</span>
            </span>
          </div>

          {connection.webhook_url && (
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs">Unsubscribe webhook</Label>
              <p className="text-xs text-muted-foreground">
                Paste this into {meta.name} → Audience → Settings → Webhooks so unsubscribes turn off
                email consent in Tamu automatically.
              </p>
              <input
                readOnly
                value={connection.webhook_url}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full select-all rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] text-foreground"
              />
            </div>
          )}

          {/* Audience / list selection */}
          <div className="space-y-1.5">
            <Label>{meta.listLabel}</Label>
            <Select value={listId} onValueChange={setListId} disabled={audiences.isPending}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue
                  placeholder={audiences.isPending ? "Loading…" : `Choose ${meta.listLabel.toLowerCase()}`}
                />
              </SelectTrigger>
              <SelectContent>
                {(audiences.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {audiences.isError && (
              <p className="text-xs text-destructive">
                {audiences.error instanceof ApiError
                  ? audiences.error.message
                  : "Could not load lists."}
              </p>
            )}
          </div>

          {/* Sync */}
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label>Sync segment</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(segments.length ? segments : [{ key: "all", label: "All contacts", count: 0, description: "" }]).map(
                    (s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                        {s.count ? ` (${s.count})` : ""}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => sync.mutate()} disabled={syncDisabled}>
              <RefreshCw className={sync.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>

            <Button
              variant="outline"
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
            >
              Disconnect
            </Button>
          </div>

          {meta.listRequired && !listId && (
            <p className="text-xs text-amber-700">Choose an audience before syncing.</p>
          )}

          {last && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    last.status === "completed"
                      ? "accent"
                      : last.status === "failed"
                        ? "warning"
                        : "muted"
                  }
                >
                  {last.status}
                </Badge>
                <span className="text-muted-foreground">
                  segment <span className="text-foreground">{last.segment}</span>
                </span>
              </div>
              <p className="mt-1.5 text-muted-foreground">{last.message ?? "—"}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CrmConnectionsPage() {
  const connections = useQuery({
    queryKey: ["crm-connections"],
    queryFn: () => fetchCrmConnections().then((r) => r.data),
  });

  const overview = useQuery({
    queryKey: ["crm-overview"],
    queryFn: () => fetchCrmOverview().then((r) => r.data),
  });

  const segments = overview.data?.segments ?? [];

  return (
    <>
      <AppTopbar breadcrumbs={[{ label: "CRM" }, { label: "Integrations", current: true }]} />

      <div className="space-y-5 p-6">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Connect an email-marketing platform to push your guest segments out for campaigns.
          </p>
        </div>

        {connections.isError && (
          <p className="text-sm text-destructive">
            {connections.error instanceof ApiError ? connections.error.message : "Failed to load integrations."}
          </p>
        )}

        {connections.isPending ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-56 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {connections.data && (
              <>
                <ProviderCard provider="klaviyo" connection={connections.data.klaviyo} segments={segments} />
                <ProviderCard provider="mailchimp" connection={connections.data.mailchimp} segments={segments} />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
