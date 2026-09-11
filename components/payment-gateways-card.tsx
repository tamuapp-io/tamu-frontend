"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { paymentsApi } from "@/lib/api/payments";
import { cn } from "@/lib/utils";
import type { PaymentGatewaysSnapshot, PaymentProvider } from "@/lib/types";

const QUERY_KEY = ["payment-gateways"];

/**
 * Owner/manager card for choosing and connecting the venue's payment gateway.
 *
 * Guests pay on the gateway's own hosted checkout and funds settle directly to
 * the venue — Tamu only opens the checkout and confirms via the webhook. A
 * venue can keep credentials for both gateways so switching back needs no
 * re-entry, but exactly one is live at a time.
 */
export function PaymentGatewaysCard() {
  const qc = useQueryClient();

  const snapshot = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => paymentsApi.gateways().then((r) => r.data),
  });

  // The deposit card asks the same question, so refresh it whenever a
  // connection changes — otherwise it keeps insisting deposits are off.
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: QUERY_KEY });
    void qc.invalidateQueries({ queryKey: ["tenant-settings"] });
  };

  const activate = useMutation({
    mutationFn: (provider: PaymentProvider) => paymentsApi.activateGateway(provider),
    onSuccess: (_r, provider) => {
      toast.success(`${labelFor(provider)} is now your active gateway`);
      invalidate();
    },
    onError: (e) =>
      toast.error("Could not switch gateway", e instanceof ApiError ? e.message : undefined),
  });

  const data = snapshot.data;
  const active = data?.active_provider ?? null;

  return (
    <Card className="overflow-hidden shadow-xs">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Payment gateway</h2>
          {active ? (
            <Badge variant="accent">
              <CheckCircle2 className="mr-1 h-3 w-3" /> {labelFor(active)} live
            </Badge>
          ) : (
            <Badge variant="muted">Not connected</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect your own Xendit or DOKU account to take deposits, menu pre-orders and
          ticket payments. Money settles directly to your account.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {snapshot.isPending && <Skeleton className="h-56 w-full" />}

        {snapshot.isError && (
          <p className="text-sm text-destructive">
            {snapshot.error instanceof ApiError
              ? snapshot.error.message
              : "Unable to load your payment connections."}
          </p>
        )}

        {data && (
          <Tabs defaultValue={active ?? "xendit"}>
            <TabsList>
              {data.providers.map((p) => (
                <TabsTrigger key={p.provider} value={p.provider} className="px-3">
                  {p.label}
                  {p.connection.configured && (
                    <span
                      aria-hidden
                      className={cn(
                        "ml-2 size-1.5 rounded-full",
                        p.provider === active ? "bg-emerald-500" : "bg-muted-foreground/40",
                      )}
                    />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="xendit" className="pt-5">
              <GatewayPanel
                provider="xendit"
                snapshot={data}
                onActivate={() => activate.mutate("xendit")}
                activating={activate.isPending}
                onChanged={invalidate}
              >
                <XenditForm onChanged={invalidate} />
              </GatewayPanel>
            </TabsContent>

            <TabsContent value="doku" className="pt-5">
              <GatewayPanel
                provider="doku"
                snapshot={data}
                onActivate={() => activate.mutate("doku")}
                activating={activate.isPending}
                onChanged={invalidate}
              >
                <DokuForm onChanged={invalidate} />
              </GatewayPanel>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Card>
  );
}

/** Connected state + webhook URL + activate/disconnect, or the connect form. */
function GatewayPanel({
  provider,
  snapshot,
  onActivate,
  activating,
  onChanged,
  children,
}: {
  provider: PaymentProvider;
  snapshot: PaymentGatewaysSnapshot;
  onActivate: () => void;
  activating: boolean;
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const entry = snapshot.providers.find((p) => p.provider === provider);
  const connection = entry?.connection;
  const isActive = snapshot.active_provider === provider;

  const disconnect = useMutation({
    mutationFn: async () => {
      // The two endpoints return different snapshot shapes and the caller only
      // refetches, so the payload is deliberately discarded.
      if (provider === "xendit") {
        await paymentsApi.disconnectXendit();
        return;
      }
      await paymentsApi.disconnectDoku();
    },
    onSuccess: () => {
      toast.success(`${labelFor(provider)} disconnected`);
      onChanged();
    },
    onError: (e) =>
      toast.error("Could not disconnect", e instanceof ApiError ? e.message : undefined),
  });

  if (!connection?.configured) return <>{children}</>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Account:{" "}
          <span className="text-foreground">{connection.account_label ?? labelFor(provider)}</span>
        </span>
        {connection.client_id_hint && (
          <span className="text-muted-foreground">
            Client ID:{" "}
            <span className="font-mono text-foreground">{connection.client_id_hint}</span>
          </span>
        )}
        {connection.secret_key_hint && (
          <span className="text-muted-foreground">
            Key: <span className="font-mono text-foreground">{connection.secret_key_hint}</span>
          </span>
        )}
      </div>

      {isActive ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          Guests pay through {labelFor(provider)}.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Connected, but guests currently pay through{" "}
            {snapshot.active_provider ? labelFor(snapshot.active_provider) : "no gateway"}.
          </p>
          <Button size="sm" onClick={onActivate} disabled={activating}>
            {activating ? "Switching…" : `Use ${labelFor(provider)}`}
          </Button>
        </div>
      )}

      {connection.webhook_url && (
        <WebhookUrl provider={provider} url={connection.webhook_url} />
      )}

      {provider === "xendit" && connection.callback_token_set === false && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          No callback verification token is stored — reconnect with your token so incoming
          payment webhooks can be verified.
        </p>
      )}

      <div className="border-t border-border pt-4">
        <Button
          variant="outline"
          onClick={() => disconnect.mutate()}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
        </Button>
      </div>
    </div>
  );
}

function WebhookUrl({ provider, url }: { provider: PaymentProvider; url: string }) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
      <Label className="text-xs">Payment webhook URL</Label>
      <p className="text-xs text-muted-foreground">
        {provider === "xendit" ? (
          <>
            In Xendit Dashboard → Settings → Webhooks, set the{" "}
            <span className="font-medium text-foreground">Invoices paid</span> and{" "}
            <span className="font-medium text-foreground">Invoices expired</span> callback URLs
            to this address, so bookings confirm automatically once guests pay.
          </>
        ) : (
          <>
            In DOKU Back Office → Configuration → Notification, set the{" "}
            <span className="font-medium text-foreground">Payment Notification URL</span> to this
            address, so bookings confirm automatically once guests pay.
          </>
        )}
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full select-all rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] text-foreground"
      />
    </div>
  );
}

function XenditForm({ onChanged }: { onChanged: () => void }) {
  const [secretKey, setSecretKey] = useState("");
  const [callbackToken, setCallbackToken] = useState("");

  const connect = useMutation({
    mutationFn: () =>
      paymentsApi.connectXendit({
        secret_key: secretKey.trim(),
        callback_token: callbackToken.trim(),
      }),
    onSuccess: () => {
      setSecretKey("");
      setCallbackToken("");
      toast.success("Xendit connected");
      onChanged();
    },
    onError: (e) =>
      toast.error("Could not connect Xendit", e instanceof ApiError ? e.message : undefined),
  });

  const canConnect = secretKey.trim().length >= 16 && callbackToken.trim().length >= 8;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="xnd-secret">Secret API Key</Label>
        <Input
          id="xnd-secret"
          type="password"
          autoComplete="off"
          placeholder="xnd_production_… or xnd_development_…"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Xendit Dashboard → Settings → Developers → API Keys. Create a Secret Key (starts with{" "}
          <code>xnd_</code>) with <strong>Money-in / Invoices: Write</strong> permission.
          Don&apos;t paste your Public Key.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="xnd-callback">Callback Verification Token</Label>
        <Input
          id="xnd-callback"
          type="password"
          autoComplete="off"
          placeholder="Webhook verification token"
          value={callbackToken}
          onChange={(e) => setCallbackToken(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Xendit Dashboard → Settings → Webhooks. We verify every payment webhook against
          this token.
        </p>
      </div>

      <Button onClick={() => connect.mutate()} disabled={connect.isPending || !canConnect}>
        {connect.isPending ? "Connecting…" : "Connect Xendit"}
      </Button>
    </div>
  );
}

function DokuForm({ onChanged }: { onChanged: () => void }) {
  const [clientId, setClientId] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const connect = useMutation({
    mutationFn: () =>
      paymentsApi.connectDoku({ client_id: clientId.trim(), secret_key: secretKey.trim() }),
    onSuccess: () => {
      setClientId("");
      setSecretKey("");
      toast.success("DOKU connected");
      onChanged();
    },
    onError: (e) =>
      toast.error("Could not connect DOKU", e instanceof ApiError ? e.message : undefined),
  });

  const canConnect = clientId.trim().length >= 8 && secretKey.trim().length >= 8;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="doku-client">Client ID</Label>
        <Input
          id="doku-client"
          autoComplete="off"
          placeholder="MCH-0001-…"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          DOKU Back Office → Configuration → API Keys.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="doku-secret">Secret Key</Label>
        <Input
          id="doku-secret"
          type="password"
          autoComplete="off"
          placeholder="Secret Key from the same page"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          DOKU signs every request and every notification with this key, so it verifies
          incoming webhooks too — there&apos;s no separate callback token. Sandbox keys only
          work against the sandbox environment.
        </p>
      </div>

      <Button onClick={() => connect.mutate()} disabled={connect.isPending || !canConnect}>
        {connect.isPending ? "Connecting…" : "Connect DOKU"}
      </Button>
    </div>
  );
}

function labelFor(provider: PaymentProvider): string {
  return provider === "doku" ? "DOKU" : "Xendit";
}
