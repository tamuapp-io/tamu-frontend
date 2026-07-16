"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Tenant, TenantMembershipSummary, User } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  /** Every venue this account can switch to. Drives the topbar picker. */
  tenants: TenantMembershipSummary[];
  hydrated: boolean;
  setSession: (payload: {
    token: string;
    user: User;
    tenant: Tenant | null;
    tenants?: TenantMembershipSummary[];
  }) => void;
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant | null) => void;
  setTenants: (tenants: TenantMembershipSummary[]) => void;
  mergeTenant: (patch: Partial<Tenant>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenant: null,
      tenants: [],
      hydrated: false,
      setSession: ({ token, user, tenant, tenants }) =>
        set((s) => ({
          token,
          user,
          tenant,
          tenants: tenants ?? s.tenants,
          hydrated: true,
        })),
      setUser: (user) => set({ user }),
      setTenant: (tenant) => set({ tenant }),
      setTenants: (tenants) => set({ tenants }),
      mergeTenant: (patch) =>
        set((s) =>
          s.tenant ? { tenant: { ...s.tenant, ...patch } } : {},
        ),
      clear: () => set({ token: null, user: null, tenant: null, tenants: [] }),
    }),
    {
      name: "tamu-auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

/**
 * Read the current bearer token without subscribing — safe to call from
 * non-React contexts (api client, server-side never sees this since the
 * client is fully client-side rendered for protected pages).
 */
export function getAuthToken(): string | null {
  return useAuthStore.getState().token;
}
