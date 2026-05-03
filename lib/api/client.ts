import type { ApiErrorBody } from "@/lib/types";
import { getAuthToken, useAuthStore } from "@/lib/store/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  code?: string;

  constructor(body: ApiErrorBody, status: number) {
    super(body.message || `Request failed with status ${status}`);
    this.status = status;
    this.errors = body.errors;
    this.code = body.code;
  }
}

type QueryValue = string | number | boolean | undefined | null;

interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  query?: object;
  body?: unknown;
  auth?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]) {
  const url = new URL(path.replace(/^\/+/, ""), `${API_URL.replace(/\/+$/, "")}/`);
  if (query) {
    for (const [key, value] of Object.entries(query as Record<string, QueryValue>)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { query, body, auth = true, headers, ...rest } = options;

  const finalHeaders = new Headers({
    Accept: "application/json",
    ...(headers as HeadersInit),
  });

  try {
    const apiOrigin = new URL(API_URL.replace(/\/+$/, ""));
    const host = apiOrigin.hostname;
    if (host.endsWith(".ngrok-free.app") || host.endsWith(".ngrok.io")) {
      finalHeaders.set("ngrok-skip-browser-warning", "true");
    }
  } catch {
    /* invalid NEXT_PUBLIC_API_URL — skip */
  }

  if (body !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
  }

  /** Set only when this request actually sends Bearer auth (see 401 handling). */
  let tokenSent: string | null = null;

  if (auth) {
    const token = getAuthToken();
    if (token) {
      tokenSent = token;
      finalHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(buildUrl(path, query), {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
    ...rest,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const json = text ? safeJson(text) : null;

  if (!res.ok) {
    if (res.status === 401 && tokenSent !== null && getAuthToken() === tokenSent) {
      // Stale responses from the previous session (e.g. slow /me after logout+login)
      // must not wipe the new token. Only clear when this 401 is for the
      // credential we still believe is active.
      useAuthStore.getState().clear();
    }
    const errBody: ApiErrorBody =
      json && typeof json === "object"
        ? (json as ApiErrorBody)
        : { message: res.statusText || "Request failed" };
    throw new ApiError(errBody, res.status);
  }

  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};

export { API_URL };
