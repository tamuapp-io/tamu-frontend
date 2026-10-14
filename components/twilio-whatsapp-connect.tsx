"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { patchSettings } from "@/lib/api/settings";
import type { WhatsappInboxStatus } from "@/lib/types";

/**
 * Connect a venue's OWN Twilio account as its WhatsApp sender.
 *
 * Owns its drafts and its mutation so the settings page doesn't have to. The
 * Auth Token is write-only: the server never returns it, so on an edit the field
 * stays blank and a blank token means "keep the saved one".
 *
 * Copy note: the explicit {" "} before inline elements is load-bearing in this
 * toolchain — a text node that follows an element loses its leading space.
 */
export function TwilioWhatsappConnect({ inbox }: { inbox: WhatsappInboxStatus | undefined }) {
  const qc = useQueryClient();
  const connected = inbox?.configured === true;

  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [sender, setSender] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (whatsapp: Record<string, unknown>) => patchSettings({ whatsapp }),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
      setSid("");
      setToken("");
      setSender("");
      setFieldErrors({});
      toast.success(vars.disconnect ? "WhatsApp disconnected" : "Twilio WhatsApp connected");
    },
    onError: (err) => {
      if (err instanceof ApiError && err.errors) {
        const next: Record<string, string> = {};
        for (const [key, messages] of Object.entries(err.errors)) {
          next[key.replace(/^whatsapp\./, "")] = messages[0] ?? "";
        }
        setFieldErrors(next);
        return;
      }

      toast.error(
        "Could not save WhatsApp settings",
        err instanceof Error ? err.message : undefined,
      );
    },
  });

  // First connection needs all three; an edit may change any subset.
  const canSave = connected
    ? sid.trim() !== "" || token.trim() !== "" || sender.trim() !== ""
    : sid.trim() !== "" && token.trim() !== "" && sender.trim() !== "";

  function submit() {
    setFieldErrors({});
    save.mutate({
      ...(sid.trim() ? { twilio_account_sid: sid.trim() } : {}),
      // Always sent, blank on an edit: the server reads blank as "keep it".
      twilio_auth_token: token.trim(),
      ...(sender.trim() ? { twilio_sender: sender.trim() } : {}),
    });
  }

  function copyWebhook() {
    if (!inbox?.webhook_url) return;
    void navigator.clipboard.writeText(inbox.webhook_url).then(
      () => toast.success("Webhook URL copied"),
      () => toast.error("Could not copy to clipboard"),
    );
  }

  return (
    <div className="space-y-5">
      {connected && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs">
          <p className="font-medium text-foreground">
            {inbox?.session_connected === false
              ? "Connected, but Twilio is rejecting these credentials"
              : "Connected to Twilio"}
          </p>
          <p className="mt-1 text-muted-foreground">
            Account{" "}
            <span className="font-mono text-foreground">{inbox?.account_sid_hint ?? "—"}</span>
            {" · sending from "}
            <span className="font-mono text-foreground">{inbox?.sender ?? "—"}</span>
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="twilio-sid">Account SID</Label>
          <Input
            id="twilio-sid"
            autoComplete="off"
            spellCheck={false}
            placeholder={connected ? "Leave blank to keep" : "AC…"}
            value={sid}
            disabled={save.isPending}
            onChange={(e) => setSid(e.target.value)}
            aria-invalid={!!fieldErrors.twilio_account_sid}
          />
          {fieldErrors.twilio_account_sid && (
            <p className="text-xs text-destructive">{fieldErrors.twilio_account_sid}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="twilio-token">Auth Token</Label>
          <Input
            id="twilio-token"
            type="password"
            autoComplete="off"
            placeholder={connected ? "Leave blank to keep" : "From your Twilio Console"}
            value={token}
            disabled={save.isPending}
            onChange={(e) => setToken(e.target.value)}
            aria-invalid={!!fieldErrors.twilio_auth_token}
          />
          {fieldErrors.twilio_auth_token && (
            <p className="text-xs text-destructive">{fieldErrors.twilio_auth_token}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="twilio-sender">WhatsApp sender</Label>
          <Input
            id="twilio-sender"
            autoComplete="off"
            spellCheck={false}
            placeholder={connected ? "Leave blank to keep" : "+628123456789 or MG…"}
            value={sender}
            disabled={save.isPending}
            onChange={(e) => setSender(e.target.value)}
            aria-invalid={!!fieldErrors.twilio_sender}
          />
          {fieldErrors.twilio_sender ? (
            <p className="text-xs text-destructive">{fieldErrors.twilio_sender}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The WhatsApp-enabled number on your Twilio account, or a Messaging Service SID.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Messages go from your own number, billed to your own Twilio account. We check
        the credentials with Twilio before saving.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!canSave || save.isPending} onClick={submit}>
          {save.isPending ? "Checking with Twilio…" : connected ? "Update" : "Connect Twilio"}
        </Button>
        {connected && (
          <Button
            type="button"
            variant="outline"
            disabled={save.isPending}
            onClick={() => save.mutate({ disconnect: true })}
          >
            Disconnect
          </Button>
        )}
      </div>

      {connected && inbox?.webhook_url && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
          <Label className="text-xs font-semibold">Webhook URL</Label>
          <p className="text-xs text-muted-foreground">
            In Twilio, open your WhatsApp sender and paste this into
            <span className="font-medium text-foreground">{" "}A message comes in</span>
            {" (HTTP POST). Delivery status is reported here automatically."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full flex-1 truncate rounded bg-background px-2 py-1 text-[11px]">
              {inbox.webhook_url}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copyWebhook}>
              <Copy className="mr-1.5 size-3.5" aria-hidden />
              Copy
            </Button>
          </div>
          <Button asChild variant="link" className="h-auto p-0 text-xs">
            <Link href="/messages">Open WhatsApp inbox →</Link>
          </Button>
        </div>
      )}

      {/* The one constraint that surprises everyone: it's WhatsApp's rule, not
          ours, and it fails quietly unless you know to look for it. */}
      <p className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>
          WhatsApp only allows free-form messages within 24 hours of a guest&apos;s last
          message. Outside that window Twilio refuses them, and the message shows as
          failed in your inbox with the reason.
        </span>
      </p>
    </div>
  );
}
