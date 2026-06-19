"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, RotateCcw, XCircle } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { eventsApi } from "@/lib/api/events";
import { ApiError } from "@/lib/api/client";
import type { ItemEnvelope, Ticket } from "@/lib/types";

type ScanResult =
  | { kind: "success"; ticket: Ticket; attendee: AttendeeMeta }
  | { kind: "duplicate"; ticket: Ticket; attendee: AttendeeMeta }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

interface AttendeeMeta {
  name?: string | null;
  ticket_type?: string | null;
  event?: string | null;
}

const SCAN_COOLDOWN_MS = 2500;

export default function CheckInScannerPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);

  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const submitCode = useCallback(async (code: string) => {
    setBusy(true);
    try {
      const res = (await eventsApi.checkIn(code)) as ItemEnvelope<Ticket> & {
        meta?: { already_checked_in?: boolean; attendee?: AttendeeMeta };
      };
      const attendee = res.meta?.attendee ?? {};
      setResult({
        kind: res.meta?.already_checked_in ? "duplicate" : "success",
        ticket: res.data,
        attendee,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        setResult({
          kind: e.code === "invalid_ticket_code" ? "invalid" : "error",
          message: e.message,
        });
      } else {
        setResult({ kind: "error", message: "Something went wrong." });
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const handleDecoded = useCallback(
    (text: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === text && now - last.at < SCAN_COOLDOWN_MS) {
        return;
      }
      lastScanRef.current = { code: text, at: now };
      void submitCode(text);
    },
    [submitCode],
  );

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let instance: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const qr = new Html5Qrcode("qr-reader");
        instance = { stop: () => qr.stop(), clear: () => qr.clear() };
        scannerRef.current = instance;
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => handleDecoded(decoded),
          () => {},
        );
      } catch {
        if (!cancelled) {
          setResult({
            kind: "error",
            message: "Could not start the camera. Grant permission or use manual entry.",
          });
          setScanning(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = instance;
      if (inst) {
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {});
      }
      scannerRef.current = null;
    };
  }, [scanning, handleDecoded]);

  return (
    <>
      <AppTopbar
        breadcrumbs={[
          { label: "Events" },
          { label: "Check-in", current: true },
        ]}
      />
      <div className="mx-auto max-w-md space-y-5 p-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div id="qr-reader" className="aspect-square w-full bg-black/90" />
          <div className="p-4">
            {scanning ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setScanning(false)}
              >
                Stop camera
              </Button>
            ) : (
              <Button className="w-full" onClick={() => { setResult(null); setScanning(true); }}>
                Start camera
              </Button>
            )}
          </div>
        </div>

        <ResultPanel result={result} busy={busy} onReset={() => setResult(null)} />

        <form
          className="space-y-2 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) {
              void submitCode(manualCode.trim());
              setManualCode("");
            }
          }}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Manual entry
          </p>
          <div className="flex gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste ticket code"
            />
            <Button type="submit" disabled={busy || !manualCode.trim()}>
              Check in
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function ResultPanel({
  result,
  busy,
  onReset,
}: {
  result: ScanResult | null;
  busy: boolean;
  onReset: () => void;
}) {
  if (busy) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground">
        Checking…
      </div>
    );
  }
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
        Point the camera at a ticket QR code.
      </div>
    );
  }

  if (result.kind === "success" || result.kind === "duplicate") {
    const ok = result.kind === "success";
    return (
      <div
        className={
          "rounded-xl border p-5 " +
          (ok
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50")
        }
      >
        <div className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
          ) : (
            <CircleAlert className="h-5 w-5 text-amber-700" />
          )}
          <p className={"font-semibold " + (ok ? "text-emerald-900" : "text-amber-900")}>
            {ok ? "Checked in" : "Already checked in"}
          </p>
        </div>
        <dl className="mt-3 space-y-1 text-sm">
          <Row label="Attendee" value={result.attendee.name ?? "—"} />
          <Row label="Ticket" value={result.attendee.ticket_type ?? "—"} />
          <Row label="Event" value={result.attendee.event ?? "—"} />
        </dl>
        <Button variant="outline" size="sm" className="mt-4" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Scan next
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
      <div className="flex items-center gap-2">
        <XCircle className="h-5 w-5 text-rose-700" />
        <p className="font-semibold text-rose-900">
          {result.kind === "invalid" ? "Invalid ticket" : "Check-in failed"}
        </p>
      </div>
      <p className="mt-2 text-sm text-rose-900/90">{result.message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onReset}>
        <RotateCcw className="h-4 w-4" /> Try again
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
