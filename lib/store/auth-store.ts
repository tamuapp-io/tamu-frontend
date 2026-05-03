"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Tenant, User } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: User | null;
  tenant: Tenant | null;
  hydrated: boolean;
  setSession: (payload: { token: string; user: User; tenant: Tenant | null }) => void;
  setUser: (user: User) => void;
  setTenant: (tenant: Tenant | null) => void;
  mergeTenant: (patch: Partial<Tenant>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      tenant: null,
      hydrated: false,
      setSession: ({ token, user, tenant }) =>
        set({ token, user, tenant, hydrated: true }),
      setUser: (user) => set({ user }),
      setTenant: (tenant) => set({ tenant }),
      mergeTenant: (patch) =>
        set((s) =>
          s.tenant ? { tenant: { ...s.tenant, ...patch } } : {},
        ),
      clear: () => set({ token: null, user: null, tenant: null }),
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
