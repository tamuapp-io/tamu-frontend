import { api } from "@/lib/api/client";
import type {
  AuthResponse,
  ItemEnvelope,
  LoginPayload,
  RegisterPayload,
  Tenant,
  TenantMembershipSummary,
  User,
} from "@/lib/types";

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<ItemEnvelope<AuthResponse>>("auth/register", payload, { auth: false }),
  login: (payload: LoginPayload) =>
    api.post<ItemEnvelope<AuthResponse>>("auth/login", payload, { auth: false }),
  logout: () => api.post<ItemEnvelope<{ logged_out: true }>>("auth/logout"),
  me: () =>
    api.get<
      ItemEnvelope<{
        user: User;
        tenant: Tenant | null;
        tenants?: TenantMembershipSummary[];
      }>
    >("auth/me"),

  /**
   * Move to another venue this account belongs to. Returns a NEW token scoped
   * to that venue — the caller must swap it in and drop any cached data from
   * the previous venue.
   */
  switchTenant: (tenantId: string) =>
    api.post<ItemEnvelope<AuthResponse>>("auth/tenants/switch", {
      tenant_id: tenantId,
    }),
  patchProfile: (payload: { name: string; email: string }) =>
    api.patch<ItemEnvelope<{ user: User }>>("auth/profile", payload),
  patchPassword: (payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) => api.patch<ItemEnvelope<{ password_updated: true }>>("auth/password", payload),
};
