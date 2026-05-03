import { api } from "@/lib/api/client";
import type {
  AuthResponse,
  ItemEnvelope,
  LoginPayload,
  RegisterPayload,
  Tenant,
  User,
} from "@/lib/types";

export const authApi = {
  register: (payload: RegisterPayload) =>
    api.post<ItemEnvelope<AuthResponse>>("auth/register", payload, { auth: false }),
  login: (payload: LoginPayload) =>
    api.post<ItemEnvelope<AuthResponse>>("auth/login", payload, { auth: false }),
  logout: () => api.post<ItemEnvelope<{ logged_out: true }>>("auth/logout"),
  me: () => api.get<ItemEnvelope<{ user: User; tenant: Tenant | null }>>("auth/me"),
  patchProfile: (payload: { name: string; email: string }) =>
    api.patch<ItemEnvelope<{ user: User }>>("auth/profile", payload),
  patchPassword: (payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }) => api.patch<ItemEnvelope<{ password_updated: true }>>("auth/password", payload),
};
