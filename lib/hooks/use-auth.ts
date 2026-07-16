"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/store/auth-store";
import type { LoginPayload, RegisterPayload } from "@/lib/types";

export function useCurrentUser() {
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const setTenant = useAuthStore((s) => s.setTenant);
  const setTenants = useAuthStore((s) => s.setTenants);

  return useQuery({
    queryKey: ["auth", "me", token],
    enabled: !!token,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await authApi.me();
      setUser(res.data.user);
      setTenant(res.data.tenant);
      if (res.data.tenants) setTenants(res.data.tenants);
      return res.data.user;
    },
  });
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const res = await authApi.login(payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSession({
        token: data.token,
        user: data.user,
        tenant: data.tenant,
        tenants: data.tenants,
      });
      qc.invalidateQueries();
    },
  });
}

/**
 * Move to another venue. The backend hands back a token scoped to that venue,
 * so we swap the token and then CLEAR the cache outright — invalidating isn't
 * enough, since every cached list still holds the previous venue's rows and
 * would flash them before refetching.
 */
export function useSwitchTenant() {
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await authApi.switchTenant(tenantId);
      return res.data;
    },
    onSuccess: (data) => {
      setSession({
        token: data.token,
        user: data.user,
        tenant: data.tenant,
        tenants: data.tenants,
      });
      qc.clear();
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const res = await authApi.register(payload);
      return res.data;
    },
    onSuccess: (data) => {
      setSession({ token: data.token, user: data.user, tenant: data.tenant });
      qc.invalidateQueries();
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        // even if the API call fails (network/token expired), drop the session.
      }
    },
    onSuccess: () => {
      clear();
      qc.clear();
    },
  });
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; email: string }) => {
      const res = await authApi.patchProfile(payload);
      return res.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      void qc.invalidateQueries({ queryKey: ["auth", "me", token] });
    },
  });
}

export function useUpdatePassword() {
  const token = useAuthStore((s) => s.token);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      current_password: string;
      password: string;
      password_confirmation: string;
    }) => {
      const res = await authApi.patchPassword(payload);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["auth", "me", token] });
    },
  });
}
