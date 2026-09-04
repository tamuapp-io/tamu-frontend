import { api } from "@/lib/api/client";
import type { PatchSettingsResponse, TenantSettingsSnapshot } from "@/lib/types";

export async function fetchSettings(): Promise<{ data: TenantSettingsSnapshot }> {
  return api.get<{ data: TenantSettingsSnapshot }>("settings");
}

/** Dashboard PATCH — may update tenant columns (`restaurant`) and JSON settings. */
export async function patchSettings(
  patch: Record<string, unknown>,
): Promise<{ data: PatchSettingsResponse }> {
  return api.patch<{ data: PatchSettingsResponse }>("settings", patch);
}

export async function syncBookingRules(payload: {
  rules: Array<{
    rule_type: string;
    config?: Record<string, unknown> | null;
    is_active?: boolean;
  }>;
}): Promise<{ data: TenantSettingsSnapshot }> {
  return api.put<{ data: TenantSettingsSnapshot }>(
    "settings/booking-rules",
    payload,
  );
}

export async function syncOperatingHours(payload: {
  periods: Array<{
    day_of_week: number;
    period_name: string;
    open_time?: string | null;
    close_time?: string | null;
    slot_duration: number;
    turn_buffer: number;
    max_covers?: number | null;
    is_closed?: boolean;
  }>;
}): Promise<{ data: TenantSettingsSnapshot }> {
  return api.put<{ data: TenantSettingsSnapshot }>(
    "settings/operating-hours",
    payload,
  );
}

/**
 * Upload a venue logo through the shared image endpoint. The server validates
 * mimes and size and stores under a tenant-scoped `branding/` folder; only the
 * returned URL is persisted, in settings.profile.logo_url.
 */
export function uploadBrandingImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "branding");
  return api.upload<{ data: { url: string; path: string; disk: string } }>(
    "uploads/image",
    form,
  );
}
