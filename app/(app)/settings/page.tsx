"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Clock, Copy, ExternalLink, MessageCircle, Plus, Trash2 } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { VenueTimezonePicker } from "@/components/venue-timezone-picker";
import { StaffBrowserNotificationsSettings } from "@/components/staff-browser-notifications-settings";
import { StaffNotificationSoundsSettings } from "@/components/staff-notification-sounds-settings";
import { ApiError } from "@/lib/api/client";
import { fetchSettings, patchSettings, syncOperatingHours } from "@/lib/api/settings";
import { useUpdatePassword, useUpdateProfile } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth-store";
import type {
  OperatingHourRow,
  TenantNotificationSettings,
  TenantSettingsSnapshot,
} from "@/lib/types";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

// 5, 10, 15, ..., 60 — matches the backend's `multiple_of:5` validation in
// PatchTenantBrandingSettingsRequest and the snap/clamp in
// Tenant::reminderMinutesBefore().
const REMINDER_LEAD_OPTIONS: number[] = Array.from(
  { length: 12 },
  (_, i) => (i + 1) * 5,
);
const REMINDER_LEAD_DEFAULT = 30;

type HoursDraftRow = {
  key: string;
  day_of_week: number;
  period_name: string;
  open_time: string;
  close_time: string;
  slot_duration: number;
  turn_buffer: number;
  max_covers: string;
  is_closed: boolean;
};

let hoursRowCounter = 0;

function draftKeyFromApi(r: OperatingHourRow, i: number): string {
  return r.id || `srv-${i}`;
}

function apiRowToDraft(r: OperatingHourRow, i: number): HoursDraftRow {
  const ot = r.open_time ?? "";
  const ct = r.close_time ?? "";

  return {
    key: draftKeyFromApi(r, i),
    day_of_week: r.day_of_week,
    period_name: r.period_name,
    open_time: ot.length >= 8 ? ot.slice(0, 5) : ot,
    close_time: ct.length >= 8 ? ct.slice(0, 5) : ct,
    slot_duration: r.slot_duration,
    turn_buffer: r.turn_buffer,
    max_covers: r.max_covers != null ? String(r.max_covers) : "",
    is_closed: r.is_closed,
  };
}

function defaultHoursRow(): HoursDraftRow {
  hoursRowCounter += 1;

  return {
    key: `new-${hoursRowCounter}`,
    day_of_week: 1,
    period_name: "Dinner",
    open_time: "18:00",
    close_time: "22:00",
    slot_duration: 30,
    turn_buffer: 15,
    max_covers: "",
    is_closed: false,
  };
}

function serializeHoursDraft(rows: HoursDraftRow[]) {
  return {
    periods: rows.map((r) => ({
      day_of_week: r.day_of_week,
      period_name: r.period_name.trim() || "Service",
      open_time: r.is_closed ? null : r.open_time.trim(),
      close_time: r.is_closed ? null : r.close_time.trim(),
      slot_duration: Math.min(180, Math.max(5, Number(r.slot_duration) || 30)),
      turn_buffer: Math.min(240, Math.max(0, Number(r.turn_buffer) || 0)),
      max_covers: (() => {
        const t = r.max_covers.trim();
        if (t === "") return null;
        const n = Number.parseInt(t, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      is_closed: r.is_closed,
    })),
  };
}

type RestaurantDraft = {
  name: string;
  timezone: string;
  isPublished: boolean;
  description: string;
  address: string;
  phone: string;
  website: string;
  cuisine: string;
  logoUrl: string;
  coverUrl: string;
  brandColor: string;
};

function snapshotToDraft(snapshot: TenantSettingsSnapshot): RestaurantDraft {
  const r = snapshot.restaurant;
  const profile =
    snapshot.settings?.profile &&
    typeof snapshot.settings.profile === "object" &&
    snapshot.settings.profile !== null
      ? (snapshot.settings.profile as Record<string, unknown>)
      : {};

  const str = (k: string) =>
    typeof profile[k] === "string"
      ? (profile[k] as string)
      : profile[k]
        ? String(profile[k])
        : "";

  return {
    name: r.name ?? "",
    timezone: r.timezone ?? "",
    isPublished: r.is_published ?? false,
    description: str("description"),
    address: str("address"),
    phone: str("phone"),
    website: str("website"),
    cuisine: str("cuisine"),
    logoUrl: str("logo_url"),
    coverUrl: str("cover_url"),
    brandColor:
      typeof snapshot.settings?.brand_color === "string"
        ? (snapshot.settings.brand_color as string)
        : "",
  };
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const mergeTenant = useAuthStore((s) => s.mergeTenant);
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();
  const updatePassword = useUpdatePassword();

  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");

  const settings = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: async () => fetchSettings().then((r) => r.data),
  });

  const [draft, setDraft] = useState<RestaurantDraft | null>(null);
  const [hoursDraft, setHoursDraft] = useState<HoursDraftRow[] | null>(null);

  useEffect(() => {
    if (!settings.data) {
      return;
    }
    // Hydrate editable copies whenever the TanStack snapshot changes (reload or save).
    /* eslint-disable react-hooks/set-state-in-effect -- mirrored from Query cache / server */
    setDraft(snapshotToDraft(settings.data));
    const hours = settings.data.operating_hours ?? [];
    setHoursDraft(hours.length > 0 ? hours.map(apiRowToDraft) : [defaultHoursRow()]);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [settings.data]);

  useEffect(() => {
    if (!user) {
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- mirror auth store user */
    setAccountName(user.name);
    setAccountEmail(user.email);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [user]);

  const saveHours = useMutation({
    mutationFn: syncOperatingHours,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-settings"] }),
  });

  // Captured at submit time so onSuccess can compare and invalidate
  // tz-dependent caches only when the venue timezone actually changed.
  const pendingTzRef = useRef<string | null>(null);

  const patch = useMutation({
    mutationFn: patchSettings,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });

      const prevTz = pendingTzRef.current;
      const nextTz = res.data.restaurant.timezone;
      pendingTzRef.current = null;

      mergeTenant({
        name: res.data.restaurant.name,
        timezone: nextTz,
        is_published: res.data.restaurant.is_published,
      });

      // When the venue timezone changes, every list view that derives day
      // windows or labels from it must refetch. Otherwise cached responses
      // keep their old `meta.tenant_timezone`, and `useVenueTimezoneFromMeta`
      // would silently revert the auth-store back to the previous zone.
      if (prevTz && nextTz && prevTz !== nextTz) {
        for (const key of [
          "reservations",
          "live",
          "walk-ins",
          "staff-waitlist",
          "reports",
        ]) {
          qc.invalidateQueries({ queryKey: [key], exact: false });
        }
        toast.success(
          "Timezone updated",
          `Reservations and reports now display in ${nextTz}.`,
        );
      } else {
        toast.success("Profile saved");
      }
    },
    onError: (err) => {
      pendingTzRef.current = null;
      const flat =
        err instanceof ApiError && err.errors
          ? Object.values(err.errors).flat()[0]
          : undefined;
      toast.error(
        "Could not save profile",
        flat ?? (err instanceof Error ? err.message : undefined),
      );
    },
  });

  const data = settings.data?.settings ?? null;
  const waitlistCfg = (
    typeof data?.waitlist === "object" && data?.waitlist !== null ? data.waitlist : {}
  ) as { enabled?: boolean; auto_promote?: boolean };

  const notificationsCfg = (
    typeof data?.notifications === "object" && data?.notifications !== null
      ? data.notifications
      : {}
  ) as TenantNotificationSettings;

  // Effective lead time displayed in the Notifications tab. Tenants
  // landing here for the first time see the global default (30) rather
  // than an empty Select; saving any value writes it through to JSON.
  const reminderLeadMinutes =
    typeof notificationsCfg.reminder_minutes_before === "number"
      ? notificationsCfg.reminder_minutes_before
      : REMINDER_LEAD_DEFAULT;

  const whatsappInbox = settings.data?.whatsapp_inbox;
  const [whatsappKeyDraft, setWhatsappKeyDraft] = useState("");

  const saveWhatsapp = useMutation({
    mutationFn: (wasender_api_key: string) =>
      patchSettings({ whatsapp: { wasender_api_key } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-settings"] });
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
      setWhatsappKeyDraft("");
      toast.success("WhatsApp settings saved");
    },
    onError: (err) => {
      const flat =
        err instanceof ApiError && err.errors
          ? Object.values(err.errors).flat()[0]
          : undefined;
      toast.error(
        "Could not save WhatsApp settings",
        flat ?? (err instanceof Error ? err.message : undefined),
      );
    },
  });

  function handleSaveWhatsappKey() {
    const key = whatsappKeyDraft.trim();
    if (key.length < 16) {
      toast.error("Invalid API key", "Enter your full WasenderAPI session key (at least 16 characters).");
      return;
    }
    saveWhatsapp.mutate(key);
  }

  function handleCopyWebhook() {
    const url = whatsappInbox?.webhook_url;
    if (!url) return;
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Webhook URL copied"),
      () => toast.error("Could not copy to clipboard"),
    );
  }

  const slug = settings.data?.restaurant.slug;
  const canSaveRestaurant =
    draft != null && draft.name.trim() !== "" && draft.timezone.trim() !== "";
  const canSaveAccount =
    accountName.trim() !== "" &&
    accountEmail.trim() !== "" &&
    (accountName.trim() !== (user?.name ?? "") ||
      accountEmail.trim().toLowerCase() !== (user?.email ?? "").toLowerCase());

  function resetAccountFromStore() {
    if (!user) return;
    setAccountName(user.name);
    setAccountEmail(user.email);
  }

  function handleSaveAccount() {
    updateProfile.mutate(
      { name: accountName.trim(), email: accountEmail.trim() },
      {
        onSuccess: () => toast.success("Profile updated"),
        onError: (err) => {
          const flat =
            err instanceof ApiError && err.errors
              ? Object.values(err.errors).flat()[0]
              : undefined;
          toast.error("Could not update profile", flat ?? (err instanceof Error ? err.message : undefined));
        },
      },
    );
  }

  function handleChangePassword() {
    if (pwdNew !== pwdConfirm) {
      toast.error("Passwords do not match", "New password and confirmation must be identical.");
      return;
    }
    updatePassword.mutate(
      {
        current_password: pwdCurrent,
        password: pwdNew,
        password_confirmation: pwdConfirm,
      },
      {
        onSuccess: () => {
          setPwdCurrent("");
          setPwdNew("");
          setPwdConfirm("");
          toast.success("Password updated");
        },
        onError: (err) => {
          const flat =
            err instanceof ApiError && err.errors
              ? Object.values(err.errors).flat()[0]
              : undefined;
          toast.error(
            "Could not update password",
            flat ?? (err instanceof Error ? err.message : undefined),
          );
        },
      },
    );
  }

  function handleSaveRestaurant() {
    if (!draft) {
      return;
    }
    pendingTzRef.current = settings.data?.restaurant.timezone ?? null;
    patch.mutate({
      restaurant: {
        name: draft.name.trim(),
        timezone: draft.timezone.trim(),
        is_published: draft.isPublished,
      },
      profile: {
        description: draft.description.trim() || null,
        address: draft.address.trim() || null,
        phone: draft.phone.trim() || null,
        website: draft.website.trim() || null,
        cuisine: draft.cuisine.trim() || null,
        logo_url: draft.logoUrl.trim() || null,
        cover_url: draft.coverUrl.trim() || null,
      },
      brand_color: draft.brandColor.trim() || null,
    });
  }

  function resetHoursFromServer() {
    if (!settings.data) return;
    const hours = settings.data.operating_hours ?? [];
    setHoursDraft(hours.length > 0 ? hours.map(apiRowToDraft) : [defaultHoursRow()]);
  }

  return (
    <>
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "Settings", current: true }]}
      />
      <div className="mx-auto max-w-3xl space-y-6 p-6 pb-14">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Restaurant settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Organized in tabs so you can edit venue, schedule, and booking behavior without
            endless scrolling.
          </p>
        </div>

        {settings.isPending && <Skeleton className="h-[480px] w-full" />}
        {settings.isError && (
          <p className="text-sm text-destructive">
            {settings.error instanceof ApiError
              ? settings.error.message
              : "Unable to load settings."}
          </p>
        )}

        {settings.data && draft && hoursDraft && (
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 p-1.5 sm:gap-1">
              <TabsTrigger value="profile" className="shrink-0 px-3">
                Profile
              </TabsTrigger>
              <TabsTrigger value="account" className="shrink-0 px-3">
                Account
              </TabsTrigger>
              <TabsTrigger value="hours" className="shrink-0 px-3">
                Hours &amp; slots
              </TabsTrigger>
              <TabsTrigger value="booking" className="shrink-0 px-3">
                Booking
              </TabsTrigger>
              <TabsTrigger value="notifications" className="shrink-0 px-3">
                Notifications
              </TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="mt-6 space-y-6 focus-visible:outline-none">
              <Card className="overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-sm font-semibold">Your profile</h2>
                  <p className="text-xs text-muted-foreground">
                    Name and sign-in email for this restaurant workspace.
                  </p>
                </div>
                <div className="space-y-4 p-6">
                  {user?.role ? (
                    <p className="text-[11px] text-muted-foreground">
                      Role: <span className="font-medium text-foreground">{user.role}</span>
                    </p>
                  ) : null}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="acct-name">Display name</Label>
                      <Input
                        id="acct-name"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="acct-email">Email</Label>
                      <Input
                        id="acct-email"
                        type="email"
                        value={accountEmail}
                        onChange={(e) => setAccountEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 px-6 py-4">
                  <Button
                    type="button"
                    disabled={!canSaveAccount || updateProfile.isPending}
                    onClick={() => void handleSaveAccount()}
                  >
                    {updateProfile.isPending ? "Saving…" : "Save profile"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetAccountFromStore()}
                    disabled={updateProfile.isPending}
                  >
                    Reset
                  </Button>
                </div>
              </Card>

              <Card className="overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-sm font-semibold">Change password</h2>
                  <p className="text-xs text-muted-foreground">
                    Use a strong password you do not reuse elsewhere.
                  </p>
                </div>
                <div className="space-y-4 p-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="pwd-current">Current password</Label>
                    <Input
                      id="pwd-current"
                      type="password"
                      value={pwdCurrent}
                      onChange={(e) => setPwdCurrent(e.target.value)}
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="pwd-new">New password</Label>
                      <Input
                        id="pwd-new"
                        type="password"
                        value={pwdNew}
                        onChange={(e) => setPwdNew(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pwd-confirm">Confirm new password</Label>
                      <Input
                        id="pwd-confirm"
                        type="password"
                        value={pwdConfirm}
                        onChange={(e) => setPwdConfirm(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 px-6 py-4">
                  <Button
                    type="button"
                    disabled={
                      updatePassword.isPending ||
                      !pwdCurrent ||
                      !pwdNew ||
                      !pwdConfirm
                    }
                    onClick={() => void handleChangePassword()}
                  >
                    {updatePassword.isPending ? "Updating…" : "Update password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPwdCurrent("");
                      setPwdNew("");
                      setPwdConfirm("");
                    }}
                    disabled={updatePassword.isPending}
                  >
                    Clear
                  </Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="mt-6 space-y-6 focus-visible:outline-none">
            <Card className="overflow-hidden shadow-xs">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h2 className="text-sm font-semibold">Restaurant identity</h2>
                <p className="text-xs text-muted-foreground">
                  Name and venue timezone — the timezone drives how reservations,
                  walk-ins, and reports are bucketed and displayed across the app.
                </p>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-muted/20 p-4">
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">
                      Public slug
                    </Label>
                    <p className="mt-1 font-mono text-sm">{slug ?? "—"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Used at /book/[slug]; contact Tamu support to rename.
                    </p>
                  </div>
                  {slug ? (
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                      <Link href={`/book/${slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="mr-2 h-3.5 w-3.5" /> Open booking page
                      </Link>
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="rs-name">Restaurant name</Label>
                    <Input
                      id="rs-name"
                      value={draft.name}
                      onChange={(e) => setDraft((d) => d && { ...d, name: e.target.value })}
                      placeholder="Restaurant name"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="rs-tz" className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      Venue timezone
                    </Label>
                    <VenueTimezonePicker
                      triggerId="rs-tz"
                      disabled={patch.isPending}
                      value={draft.timezone}
                      onChange={(iana) =>
                        setDraft((d) => d && { ...d, timezone: iana })
                      }
                      showSuggestFromBrowser
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Reservation times, walk-in clocks, and report windows are
                      shown in this zone.{" "}
                      {draft.timezone &&
                      draft.timezone !== (settings.data?.restaurant.timezone ?? "") ? (
                        <span className="font-medium text-foreground">
                          Unsaved change — current saved zone is{" "}
                          {settings.data?.restaurant.timezone || "UTC"}.
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 sm:col-span-2">
                    <div>
                      <Label className="text-sm font-medium">Publishing</Label>
                      <p className="text-[11px] text-muted-foreground">
                        Disabled hides your public booking page (404).
                      </p>
                    </div>
                    <Switch
                      checked={draft.isPublished}
                      disabled={patch.isPending}
                      onCheckedChange={(isPublished) =>
                        setDraft((d) => d && { ...d, isPublished })
                      }
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden shadow-xs">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h2 className="text-sm font-semibold">Public profile</h2>
                <p className="text-xs text-muted-foreground">
                  Shown on your booking widget — keep it succinct and factual.
                </p>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rs-desc">Description</Label>
                  <textarea
                    id="rs-desc"
                    rows={4}
                    className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, description: e.target.value })
                    }
                    placeholder="A short welcoming blurb."
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rs-address">Address</Label>
                  <Input
                    id="rs-address"
                    value={draft.address}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, address: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-phone">Phone (public)</Label>
                  <Input
                    id="rs-phone"
                    value={draft.phone}
                    onChange={(e) => setDraft((d) => d && { ...d, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-site">Website</Label>
                  <Input
                    id="rs-site"
                    value={draft.website}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, website: e.target.value })
                    }
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rs-cuisine">Cuisine</Label>
                  <Input
                    id="rs-cuisine"
                    value={draft.cuisine}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, cuisine: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-logo">Logo URL</Label>
                  <Input
                    id="rs-logo"
                    value={draft.logoUrl}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, logoUrl: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rs-cover">Cover image URL</Label>
                  <Input
                    id="rs-cover"
                    value={draft.coverUrl}
                    onChange={(e) =>
                      setDraft((d) => d && { ...d, coverUrl: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rs-brand">Brand color (accent)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="rs-brand"
                      value={draft.brandColor}
                      onChange={(e) =>
                        setDraft((d) => d && { ...d, brandColor: e.target.value })
                      }
                      placeholder="#0f766e"
                      className="max-w-[220px]"
                    />
                    <input
                      aria-label="Pick brand color"
                      type="color"
                      className="h-10 w-14 cursor-pointer rounded-md border border-border bg-background px-1"
                      value={
                        /^#([0-9a-f]{6})$/i.test(draft.brandColor.trim())
                          ? draft.brandColor.trim()
                          : "#0f766e"
                      }
                      onChange={(e) =>
                        setDraft((d) => d && { ...d, brandColor: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 px-6 py-4">
                <Button
                  type="button"
                  disabled={!canSaveRestaurant || patch.isPending}
                  onClick={() => void handleSaveRestaurant()}
                >
                  {patch.isPending ? "Saving…" : "Save venue & profile"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => settings.data && setDraft(snapshotToDraft(settings.data))}
                >
                  Reset changes
                </Button>
              </div>
            </Card>
            </TabsContent>

            <TabsContent value="hours" className="mt-6 space-y-6 focus-visible:outline-none">
            <Card className="overflow-hidden shadow-xs">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h2 className="text-sm font-semibold">Opening hours &amp; slots</h2>
                <p className="text-xs text-muted-foreground">
                  Times follow your venue timezone ({settings.data.restaurant.timezone}). Slot step
                  is the interval between bookable start times; turn buffer is spacing between
                  parties.
                </p>
              </div>
              <div className="space-y-4 p-6">
                {saveHours.error instanceof ApiError &&
                  !saveHours.error.errors &&
                  typeof saveHours.error.message === "string" && (
                    <p className="text-sm text-destructive" role="alert">
                      {saveHours.error.message}
                    </p>
                  )}
                <div className="space-y-4">
                  {hoursDraft.map((row, idx) => (
                    <div
                      key={row.key}
                      className="space-y-3 rounded-lg border border-border bg-muted/10 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium uppercase text-muted-foreground">
                          Period {idx + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:text-destructive"
                          disabled={hoursDraft.length <= 1 || saveHours.isPending}
                          onClick={() =>
                            setHoursDraft((rows) =>
                              rows && rows.length > 1
                                ? rows.filter((_, i) => i !== idx)
                                : rows,
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Remove period</span>
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Day</Label>
                          <Select
                            value={String(row.day_of_week)}
                            onValueChange={(v) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx ? { ...r, day_of_week: Number(v) } : r,
                                ) ?? rows,
                              )
                            }
                            disabled={row.is_closed}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAY_LABELS.map((label, dow) => (
                                <SelectItem key={label} value={String(dow)}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                          <Label className="text-xs">Period name</Label>
                          <Input
                            className="h-9"
                            value={row.period_name}
                            onChange={(e) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx ? { ...r, period_name: e.target.value } : r,
                                ) ?? rows,
                              )
                            }
                            placeholder="e.g. Lunch"
                            disabled={row.is_closed}
                          />
                        </div>
                        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
                          <div className="flex grow items-center justify-between rounded-md border border-border px-3 py-2">
                            <Label className="text-xs font-normal">Closed</Label>
                            <Switch
                              checked={row.is_closed}
                              onCheckedChange={(is_closed) =>
                                setHoursDraft((rows) =>
                                  rows?.map((r, i) =>
                                    i === idx ? { ...r, is_closed } : r,
                                  ) ?? rows,
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Opens</Label>
                          <Input
                            className="h-9"
                            type="time"
                            value={row.open_time}
                            onChange={(e) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx ? { ...r, open_time: e.target.value } : r,
                                ) ?? rows,
                              )
                            }
                            disabled={row.is_closed}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Closes</Label>
                          <Input
                            className="h-9"
                            type="time"
                            value={row.close_time}
                            onChange={(e) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx ? { ...r, close_time: e.target.value } : r,
                                ) ?? rows,
                              )
                            }
                            disabled={row.is_closed}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Slot step (min)</Label>
                          <Input
                            className="h-9"
                            type="number"
                            min={5}
                            max={180}
                            value={row.slot_duration || ""}
                            onChange={(e) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        slot_duration:
                                          Number.parseInt(e.target.value, 10) || 0,
                                      }
                                    : r,
                                ) ?? rows,
                              )
                            }
                            disabled={row.is_closed}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Turn buffer (min)</Label>
                          <Input
                            className="h-9"
                            type="number"
                            min={0}
                            max={240}
                            value={row.turn_buffer}
                            onChange={(e) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        turn_buffer:
                                          Number.parseInt(e.target.value, 10) || 0,
                                      }
                                    : r,
                                ) ?? rows,
                              )
                            }
                            disabled={row.is_closed}
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label className="text-xs">
                            Max covers / slot{" "}
                            <span className="font-normal text-muted-foreground">
                              (optional)
                            </span>
                          </Label>
                          <Input
                            className="h-9"
                            type="number"
                            min={1}
                            placeholder="No limit"
                            value={row.max_covers}
                            onChange={(e) =>
                              setHoursDraft((rows) =>
                                rows?.map((r, i) =>
                                  i === idx ? { ...r, max_covers: e.target.value } : r,
                                ) ?? rows,
                              )
                            }
                            disabled={row.is_closed}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setHoursDraft((rows) => [...(rows ?? []), defaultHoursRow()])}
                  disabled={saveHours.isPending}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add period
                </Button>
              </div>
              <div className="flex flex-wrap gap-3 border-t border-border bg-muted/10 px-6 py-4">
                <Button
                  type="button"
                  disabled={saveHours.isPending || hoursDraft.length < 1}
                  onClick={() => saveHours.mutate(serializeHoursDraft(hoursDraft))}
                >
                  {saveHours.isPending ? "Saving…" : "Save hours & slots"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resetHoursFromServer()}
                  disabled={saveHours.isPending}
                >
                  Reset hours
                </Button>
              </div>
            </Card>
            </TabsContent>

            <TabsContent value="booking" className="mt-6 space-y-6 focus-visible:outline-none">
            <Card className="overflow-hidden shadow-xs">
              <div className="border-b border-border bg-muted/30 px-6 py-4">
                <h2 className="text-sm font-semibold">Booking experience</h2>
              </div>
              <div className="divide-y divide-border px-6">
                <div className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <Label className="text-sm font-semibold">Waitlist</Label>
                    <p className="text-xs text-muted-foreground">
                      Allow guests to join the queue when a slot is unavailable.
                    </p>
                  </div>
                  <Switch
                    checked={waitlistCfg.enabled !== false}
                    disabled={patch.isPending}
                    onCheckedChange={(enabled) =>
                      patch.mutate({ waitlist: { ...waitlistCfg, enabled } })
                    }
                  />
                </div>
                <div className="flex items-start justify-between gap-4 py-4">
                  <div>
                    <Label className="text-sm font-semibold">Auto-promote waitlist</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically assign the next waitlist party when tables free up.
                    </p>
                  </div>
                  <Switch
                    checked={waitlistCfg.auto_promote !== false}
                    disabled={patch.isPending || waitlistCfg.enabled === false}
                    onCheckedChange={(auto_promote) =>
                      patch.mutate({
                        waitlist: { ...waitlistCfg, auto_promote },
                      })
                    }
                  />
                </div>
              </div>
            </Card>

            <details className="rounded-xl border border-dashed border-border bg-card px-6 py-3 text-sm shadow-xs">
              <summary className="cursor-pointer font-medium outline-none [&::-webkit-details-marker]:hidden [&::marker]:content-none">
                Technical — booking rules (read-only snapshot)
              </summary>
              <pre className="mt-4 max-h-72 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
                {JSON.stringify(settings.data.booking_rules, null, 2)}
              </pre>
            </details>

            <Button type="button" variant="ghost" size="sm" onClick={() => settings.refetch()}>
              Reload from server
            </Button>
            </TabsContent>

            <TabsContent
              value="notifications"
              className="mt-6 space-y-6 focus-visible:outline-none"
            >
              <Card className="overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-sm font-semibold">Staff desktop alerts</h2>
                  <p className="text-xs text-muted-foreground">
                    Browser notifications for new reservations while Tamu is open.
                  </p>
                </div>
                <div className="p-6">
                  <StaffBrowserNotificationsSettings />
                </div>
              </Card>

              <Card className="overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-sm font-semibold">Alert sounds</h2>
                  <p className="text-xs text-muted-foreground">
                    Distinct sounds for new bookings and WhatsApp messages.
                  </p>
                </div>
                <div className="p-6">
                  <StaffNotificationSoundsSettings />
                </div>
              </Card>

              <Card className="overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <h2 className="text-sm font-semibold">Guest reminders</h2>
                  <p className="text-xs text-muted-foreground">
                    Email + WhatsApp reminders fire automatically before each
                    confirmed reservation.
                  </p>
                </div>
                <div className="space-y-5 p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-md">
                      <Label
                        htmlFor="reminder-lead"
                        className="text-sm font-semibold"
                      >
                        Reminder lead time
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        How long before the reservation to send the reminder.
                        Choose any value from 5 to 60 minutes, in 5-minute
                        steps.
                      </p>
                    </div>
                    <Select
                      value={String(reminderLeadMinutes)}
                      disabled={patch.isPending}
                      onValueChange={(value) => {
                        const minutes = Number(value);
                        if (!Number.isFinite(minutes)) return;
                        patch.mutate({
                          notifications: {
                            ...notificationsCfg,
                            reminder_minutes_before: minutes,
                          },
                        });
                      }}
                    >
                      <SelectTrigger id="reminder-lead" className="w-40">
                        <SelectValue placeholder="Select lead time" />
                      </SelectTrigger>
                      <SelectContent>
                        {REMINDER_LEAD_OPTIONS.map((m) => (
                          <SelectItem key={m} value={String(m)}>
                            {m === 60 ? "1 hour" : `${m} minutes`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                    Reminders fire at{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {reminderLeadMinutes === 60
                        ? "1 hour"
                        : `${reminderLeadMinutes} minutes`}
                    </span>{" "}
                    before each reservation. The scheduler ticks every 5
                    minutes, so the actual send fires within a ±5-minute
                    window around your target.
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden shadow-xs">
                <div className="border-b border-border bg-muted/30 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="size-4 text-muted-foreground" aria-hidden />
                    <h2 className="text-sm font-semibold">WhatsApp inbox</h2>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {whatsappInbox?.provider === "meta"
                      ? "WhatsApp is connected via Meta Cloud API. Configure the webhook URL in your Meta app dashboard."
                      : "Connect your restaurant's WasenderAPI session to receive guest replies and chat from the WhatsApp page."}
                  </p>
                </div>
                <div className="space-y-5 p-6">
                  {whatsappInbox?.provider === "meta" ? (
                    <>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
                        Meta WhatsApp Cloud API is active for this environment.
                        {whatsappInbox.session_connected === false
                          ? " Connection check failed — verify your access token and phone number in Laravel Cloud env vars."
                          : whatsappInbox.session_connected
                            ? " Connection looks healthy."
                            : null}
                      </div>

                      {whatsappInbox.webhook_url ? (
                        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                          <Label className="text-xs font-semibold">Meta webhook URL</Label>
                          <p className="text-xs text-muted-foreground">
                            In Meta Developer → WhatsApp → Configuration, subscribe to{" "}
                            <code className="text-[11px]">messages</code> and paste this callback URL.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="max-w-full flex-1 truncate rounded bg-background px-2 py-1 text-[11px]">
                              {whatsappInbox.webhook_url}
                            </code>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleCopyWebhook}
                            >
                              <Copy className="mr-1.5 size-3.5" aria-hidden />
                              Copy
                            </Button>
                          </div>
                          <Button asChild variant="link" className="h-auto p-0 text-xs">
                            <Link href="/messages">Open WhatsApp inbox →</Link>
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                  {whatsappInbox?.configured && whatsappInbox.api_key_hint ? (
                    <p className="text-xs text-muted-foreground">
                      Current key:{" "}
                      <span className="font-mono text-foreground">
                        {whatsappInbox.api_key_hint}
                      </span>
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="wasender-api-key">WasenderAPI session key</Label>
                    <Input
                      id="wasender-api-key"
                      type="password"
                      autoComplete="off"
                      placeholder={
                        whatsappInbox?.configured
                          ? "Paste a new key to replace the saved one"
                          : "Paste your session API key from WasenderAPI"
                      }
                      value={whatsappKeyDraft}
                      disabled={saveWhatsapp.isPending}
                      onChange={(e) => setWhatsappKeyDraft(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Each restaurant uses its own WhatsApp number via a
                      WasenderAPI session. Find the session API key in your
                      WasenderAPI dashboard.
                    </p>
                  </div>

                  <Button
                    type="button"
                    disabled={saveWhatsapp.isPending || whatsappKeyDraft.trim().length < 16}
                    onClick={handleSaveWhatsappKey}
                  >
                    {whatsappInbox?.configured ? "Update API key" : "Save API key"}
                  </Button>

                  {whatsappInbox?.configured && whatsappInbox.webhook_url ? (
                    <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
                      <Label className="text-xs font-semibold">Webhook URL</Label>
                      <p className="text-xs text-muted-foreground">
                        Paste this URL into WasenderAPI webhook settings so
                        inbound messages appear in your inbox.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="max-w-full flex-1 truncate rounded bg-background px-2 py-1 text-[11px]">
                          {whatsappInbox.webhook_url}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyWebhook}
                        >
                          <Copy className="mr-1.5 size-3.5" aria-hidden />
                          Copy
                        </Button>
                      </div>
                      <Button asChild variant="link" className="h-auto p-0 text-xs">
                        <Link href="/messages">Open WhatsApp inbox →</Link>
                      </Button>
                    </div>
                  ) : null}
                    </>
                  )}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
