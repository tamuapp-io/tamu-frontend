"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Cake, Clock, TriangleAlert } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { fetchAutomations, fetchCrmOverview, updateAutomations } from "@/lib/api/crm";
import type { CrmAutomationConfig, CrmWinbackConfig } from "@/lib/types";

const MERGE_TAGS = ["{{first_name}}", "{{venue}}"];

function MessageTags({ onInsert }: { onInsert: (tag: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Insert:</span>
      {MERGE_TAGS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onInsert(tag)}
          className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted"
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

type SavePatch = Partial<CrmWinbackConfig> & { enabled?: boolean; message?: string };

function AutomationCard({
  kind,
  title,
  description,
  icon,
  initial,
  disabledReason,
}: {
  kind: "birthday" | "winback";
  title: string;
  description: string;
  icon: React.ReactNode;
  initial: CrmAutomationConfig | CrmWinbackConfig;
  disabledReason?: string | null;
}) {
  const qc = useQueryClient();
  const isWinback = kind === "winback";
  const winback = initial as CrmWinbackConfig;

  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [minDays, setMinDays] = useState(isWinback ? winback.min_days : 90);
  const [cooldown, setCooldown] = useState(isWinback ? winback.cooldown_days : 60);

  const save = useMutation({
    mutationFn: (patch: SavePatch) => updateAutomations({ [kind]: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-automations"] });
      toast.success("Automation saved");
    },
    onError: (e) => toast.error("Could not save", e instanceof ApiError ? e.message : undefined),
  });

  const currentPatch = (): SavePatch => ({
    enabled,
    message,
    ...(isWinback ? { min_days: minDays, cooldown_days: cooldown } : {}),
  });

  const toggle = (v: boolean) => {
    setEnabled(v);
    save.mutate({ ...currentPatch(), enabled: v });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-foreground">{icon}</span>
          <div>
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch checked={enabled} onCheckedChange={toggle} aria-label={`Enable ${title}`} />
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${kind}-msg`}>Message</Label>
          <textarea
            id={`${kind}-msg`}
            rows={4}
            maxLength={2000}
            className="flex w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <MessageTags onInsert={(tag) => setMessage((m) => `${m}${tag}`)} />
        </div>

        {isWinback && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="wb-min">Lapsed after (days)</Label>
              <Input
                id="wb-min"
                type="number"
                min={7}
                max={365}
                value={minDays}
                onChange={(e) => setMinDays(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wb-cool">Re-send cooldown (days)</Label>
              <Input
                id="wb-cool"
                type="number"
                min={7}
                max={365}
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
              />
            </div>
          </div>
        )}

        {disabledReason && (
          <p className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {disabledReason}
          </p>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => save.mutate(currentPatch())} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CrmAutomationsPage() {
  const automations = useQuery({
    queryKey: ["crm-automations"],
    queryFn: () => fetchAutomations().then((r) => r.data),
  });
  const overview = useQuery({
    queryKey: ["crm-overview"],
    queryFn: () => fetchCrmOverview().then((r) => r.data),
  });

  const whatsappReady = overview.data?.channels.whatsapp_ready ?? true;
  const waWarning = whatsappReady ? null : "WhatsApp isn’t connected — automations won’t send until you set it up in Settings.";

  return (
    <>
      <AppTopbar breadcrumbs={[{ label: "CRM" }, { label: "Automations", current: true }]} />

      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          Hands-off WhatsApp messages that run daily and only reach opted-in contacts.{" "}
          {!whatsappReady && (
            <Link href="/settings" className="font-medium underline">
              Connect WhatsApp
            </Link>
          )}
        </p>

        {automations.isError && (
          <p className="text-sm text-destructive">
            {automations.error instanceof ApiError ? automations.error.message : "Failed to load automations."}
          </p>
        )}

        {automations.isPending ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          automations.data && (
            <div className="grid gap-4 lg:grid-cols-2">
              <AutomationCard
                key={`birthday-${JSON.stringify(automations.data.birthday)}`}
                kind="birthday"
                title="Birthday greeting"
                description="On each guest's birthday, send a greeting (needs a birthday on file)."
                icon={<Cake className="h-5 w-5" />}
                initial={automations.data.birthday}
                disabledReason={waWarning}
              />
              <AutomationCard
                key={`winback-${JSON.stringify(automations.data.winback)}`}
                kind="winback"
                title="Win-back lapsed guests"
                description="Nudge guests who haven’t visited in a while to come back."
                icon={<Clock className="h-5 w-5" />}
                initial={automations.data.winback}
                disabledReason={waWarning}
              />
            </div>
          )
        )}
      </div>
    </>
  );
}
