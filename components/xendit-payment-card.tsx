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
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { paymentsApi } from "@/lib/api/payments";

/**
 * Owner/manager card for connecting the venue's own Xendit account. Guests pay
 * on Xendit's hosted checkout and funds settle directly to the venue — Tamu
 * only orchestrates the invoice + confirms via the webhook.
 */
export function XenditPaymentCard() {
  const qc = useQueryClient();
  const [secretKey, setSecretKey] = useState("");
  const [callbackToken, setCallbackToken] = useState("");

  const snapshot = useQuery({
    queryKey: ["xendit-connection"],
    queryFn: () => paymentsApi.xenditSnapshot().then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["xendit-connection"] });

  const connect = useMutation({
    mutationFn: () =>
      paymentsApi.connectXendit({
        secret_key: secretKey.trim(),
        callback_token: callbackToken.trim(),
      }),
    onSuccess: () => {
      setSecretKey("");
      setCallbackToken("");
      toast.success("Xendit connected", "You can now sell paid tickets.");
      invalidate();
    },
    onError: (e) =>
      toast.error("Could not connect Xendit", e instanceof ApiError ? e.message : undefined),
  });

  const disconnect = useMutation({
    mutationFn: () => paymentsApi.disconnectXendit(),
    onSuccess: () => {
      toast.success("Xendit disconnected");
      invalidate();
    },
  });

  const data = snapshot.data;
  const configured = data?.configured ?? false;
  const canConnect = secretKey.trim().length >= 16 && callbackToken.trim().length >= 8;

  return (
    <Card className="overflow-hidden shadow-xs">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Xendit payment gateway</h2>
          {configured ? (
            <Badge variant="accent">
              <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
            </Badge>
          ) : (
            <Badge variant="muted">Not connected</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Connect your own Xendit account to accept real payments for paid tickets.
          Money settles directly to your Xendit balance.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {snapshot.isPending && <Skeleton className="h-40 w-full" />}

        {snapshot.isError && (
          <p className="text-sm text-destructive">
            {snapshot.error instanceof ApiError
              ? snapshot.error.message
              : "Unable to load the payment connection."}
          </p>
        )}

        {data && !configured && (
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
                Xendit Dashboard → Settings → Developers → API Keys. Create a Secret Key
                (starts with <code>xnd_</code>) with <strong>Money-in / Invoices: Write</strong>{" "}
                permission. Don&apos;t paste your Public Key.
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
                Xendit Dashboard → Settings → Webhooks. We verify every payment
                webhook against this token.
              </p>
            </div>

            <Button onClick={() => connect.mutate()} disabled={connect.isPending || !canConnect}>
              {connect.isPending ? "Connecting…" : "Connect Xendit"}
            </Button>
          </div>
        )}

        {data && configured && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">
                Account: <span className="text-foreground">{data.account_label ?? "Xendit"}</span>
              </span>
              <span className="text-muted-foreground">
                Key: <span className="font-mono text-foreground">{data.secret_key_hint}</span>
              </span>
            </div>

            {data.webhook_url && (
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
                <Label className="text-xs">Payment webhook URL</Label>
                <p className="text-xs text-muted-foreground">
                  In Xendit Dashboard → Settings → Webhooks, set the{" "}
                  <span className="font-medium text-foreground">Invoices paid</span> and{" "}
                  <span className="font-medium text-foreground">Invoices expired</span> callback
                  URLs to this address so tickets are issued automatically once guests pay.
                </p>
                <input
                  readOnly
                  value={data.webhook_url}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full select-all rounded-md border border-border bg-card px-2 py-1.5 font-mono text-[11px] text-foreground"
                />
              </div>
            )}

            {!data.callback_token_set && (
              <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                No callback verification token is stored — reconnect with your token so
                incoming payment webhooks can be verified.
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
        )}
      </div>
    </Card>
  );
}
