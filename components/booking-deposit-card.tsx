"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { fetchSettings, syncBookingRules } from "@/lib/api/settings";
import { paymentsApi } from "@/lib/api/payments";
import { formatMoney } from "@/lib/format";

const RULE = "deposit_required";

type DepositDraft = {
  enabled: boolean;
  /** Whole rupiah as typed by the venue; stored as true cents (×100). */
  amount: string;
  perPerson: boolean;
  minPartySize: string;
};

/**
 * Configures the `deposit_required` booking rule: how much an online guest must
 * pre-pay to confirm a booking. Deposits are only ever collected when a payment
 * gateway is connected, so this card surfaces that dependency.
 */
export function BookingDepositCard() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DepositDraft | null>(null);

  const settings = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => fetchSettings().then((r) => r.data),
  });

  const gateway = useQuery({
    queryKey: ["xendit-connection"],
    queryFn: () => paymentsApi.xenditSnapshot().then((r) => r.data),
  });

  useEffect(() => {
    if (!settings.data) return;
    const row = settings.data.booking_rules?.find((r) => r.rule_type === RULE);
    const cfg = (row?.config ?? {}) as Record<string, unknown>;
    const cents = typeof cfg.amount_cents === "number" ? cfg.amount_cents : 0;
    /* eslint-disable react-hooks/set-state-in-effect -- mirrored from Query cache */
    setDraft({
      enabled: !!row?.is_active && !!cfg.enabled,
      amount: cents > 0 ? String(cents / 100) : "",
      perPerson: !!cfg.per_person,
      minPartySize:
        typeof cfg.min_party_size === "number" && cfg.min_party_size > 0
          ? String(cfg.min_party_size)
          : "",
    });
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => {
      const rupiah = Math.max(0, Math.round(Number(draft?.amount || 0)));
      return syncBookingRules({
        rules: [
          {
            rule_type: RULE,
            is_active: !!draft?.enabled,
            config: {
              enabled: !!draft?.enabled,
              // The engine stores true cents (rupiah × 100).
              amount_cents: rupiah * 100,
              per_person: !!draft?.perPerson,
              min_party_size: Math.max(0, Math.round(Number(draft?.minPartySize || 0))),
            },
          },
        ],
      });
    },
    onSuccess: () => {
      toast.success("Deposit settings saved");
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
    onError: (e) =>
      toast.error("Could not save deposit", e instanceof ApiError ? e.message : undefined),
  });

  if (settings.isPending || !draft) {
    return <Skeleton className="h-64 w-full" />;
  }

  const rupiah = Math.max(0, Math.round(Number(draft.amount || 0)));
  const amountInvalid = draft.enabled && rupiah <= 0;
  const gatewayConnected = gateway.data?.configured ?? false;

  return (
    <Card className="overflow-hidden shadow-xs">
      <div className="border-b border-border bg-muted/30 px-6 py-4">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Booking deposit</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Require online guests to pre-pay to confirm a booking. The slot is held while
          they pay and released automatically if the payment expires.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {!gatewayConnected && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            Connect Xendit above first — deposits are skipped entirely while no payment
            gateway is connected, and bookings confirm as normal.
          </p>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-sm font-semibold">Require a deposit</Label>
            <p className="text-xs text-muted-foreground">
              Applies to online bookings only — walk-ins and staff bookings never pre-pay.
            </p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
          />
        </div>

        {draft.enabled && (
          <div className="space-y-5 border-t border-border pt-5">
            <div className="space-y-1.5">
              <Label htmlFor="dep-amount">Deposit amount (Rp)</Label>
              <Input
                id="dep-amount"
                inputMode="numeric"
                placeholder="50000"
                value={draft.amount}
                invalid={amountInvalid}
                onChange={(e) =>
                  setDraft({ ...draft, amount: e.target.value.replace(/[^\d]/g, "") })
                }
                className="max-w-xs"
              />
              {amountInvalid ? (
                <p className="text-xs text-destructive">Enter an amount greater than zero.</p>
              ) : (
                rupiah > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Guests pay {formatMoney(rupiah * 100, "IDR")}
                    {draft.perPerson ? " per person" : " per booking"}.
                  </p>
                )
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold">Charge per person</Label>
                <p className="text-xs text-muted-foreground">
                  Multiply the amount by party size instead of charging a flat fee.
                </p>
              </div>
              <Switch
                checked={draft.perPerson}
                onCheckedChange={(perPerson) => setDraft({ ...draft, perPerson })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dep-min">Only for parties of this size or larger</Label>
              <Input
                id="dep-min"
                inputMode="numeric"
                placeholder="0 = every booking"
                value={draft.minPartySize}
                onChange={(e) =>
                  setDraft({ ...draft, minPartySize: e.target.value.replace(/[^\d]/g, "") })
                }
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to require a deposit on every online booking. Set e.g. 6 to only
                charge large groups.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 px-6 py-4">
        <Button
          type="button"
          disabled={save.isPending || amountInvalid}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Saving…" : "Save deposit settings"}
        </Button>
      </div>
    </Card>
  );
}
