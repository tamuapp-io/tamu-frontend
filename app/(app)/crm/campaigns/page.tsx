"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Send, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createCampaign,
  fetchCampaigns,
  fetchCrmOverview,
  previewCampaign,
  sendCampaign,
} from "@/lib/api/crm";
import type { CampaignStatus, CampaignSummary } from "@/lib/types";

const STATUS_VARIANT: Record<CampaignStatus, "muted" | "info" | "accent" | "warning"> = {
  draft: "muted",
  sending: "info",
  sent: "accent",
  failed: "warning",
};

const MERGE_TAGS = ["{{first_name}}", "{{name}}", "{{venue}}"];

function CreateCampaignDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("all");
  const [body, setBody] = useState("");

  const overview = useQuery({
    queryKey: ["crm-overview"],
    queryFn: () => fetchCrmOverview().then((r) => r.data),
  });
  const segments = overview.data?.segments ?? [];

  const preview = useQuery({
    queryKey: ["campaign-preview", segment],
    queryFn: () => previewCampaign(segment).then((r) => r.data),
  });

  const reset = () => {
    setName("");
    setSegment("all");
    setBody("");
  };

  const save = useMutation({
    mutationFn: async (send: boolean) => {
      const created = await createCampaign({ name: name.trim(), segment, message_body: body.trim() });
      if (send) await sendCampaign(created.data.id);
      return send;
    },
    onSuccess: (sent) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(sent ? "Campaign sent" : "Draft saved");
      reset();
      onOpenChange(false);
    },
    onError: (e) => toast.error("Could not save campaign", e instanceof ApiError ? e.message : undefined),
  });

  const ready = preview.data?.whatsapp_ready ?? true;
  const audience = preview.data?.audience_count ?? 0;
  const valid = name.trim().length > 0 && body.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New WhatsApp campaign</DialogTitle>
          <DialogDescription>
            Sends to opted-in WhatsApp contacts in the chosen segment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cmp-name">Name</Label>
            <Input
              id="cmp-name"
              placeholder="e.g. June win-back"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Segment</Label>
            <Select value={segment} onValueChange={setSegment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(segments.length ? segments : [{ key: "all", label: "All contacts", count: 0, description: "" }]).map(
                  (s) => (
                    <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {preview.isPending
                ? "Counting audience…"
                : `Will reach ${audience} opted-in WhatsApp ${audience === 1 ? "contact" : "contacts"}.`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cmp-body">Message</Label>
            <textarea
              id="cmp-body"
              rows={5}
              maxLength={2000}
              className="flex w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Hi {{first_name}}, we miss you at {{venue}}…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Insert:</span>
              {MERGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setBody((b) => `${b}${tag}`)}
                  className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {!ready && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              WhatsApp isn&rsquo;t connected. Set it up in{" "}
              <Link href="/settings" className="font-medium underline">
                Settings
              </Link>{" "}
              to send.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => save.mutate(false)} disabled={!valid || save.isPending}>
            Save draft
          </Button>
          <Button onClick={() => save.mutate(true)} disabled={!valid || save.isPending || !ready || audience === 0}>
            <Send className="h-4 w-4" />
            {save.isPending ? "Working…" : "Send now"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CrmCampaignsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const list = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => fetchCampaigns().then((r) => r.data),
  });

  const send = useMutation({
    mutationFn: (id: string) => sendCampaign(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign sent");
    },
    onError: (e) => toast.error("Send failed", e instanceof ApiError ? e.message : undefined),
  });

  const rows: CampaignSummary[] = list.data ?? [];

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "CRM" }, { label: "Campaigns", current: true }]}
        primaryAction={{ label: "New campaign", onClick: () => setCreateOpen(true) }}
      />

      <div className="space-y-4 p-6">
        {list.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Megaphone className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Send a WhatsApp broadcast to a guest segment — birthdays, win-backs, announcements.
            </p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Megaphone className="h-4 w-4" /> New campaign
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Campaign</th>
                  <th className="px-4 py-2.5 font-medium">Segment</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Audience</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sent</th>
                  <th className="px-4 py-2.5 text-right font-medium">Failed</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{c.name}</div>
                      <div className="max-w-md truncate text-xs text-muted-foreground">{c.message_body}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.segment}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.audience_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.sent_count}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.failed_count}</td>
                    <td className="px-4 py-2.5 text-right">
                      {c.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => send.mutate(c.id)}
                          disabled={send.isPending}
                        >
                          <Send className="h-3.5 w-3.5" /> Send
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CreateCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}
