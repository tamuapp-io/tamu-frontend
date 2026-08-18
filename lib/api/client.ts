import type { ApiErrorBody } from "@/lib/types";
import { getAuthToken, useAuthStore } from "@/lib/store/auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** HTTP origin only (drops `/api/v1`) — used by WebSocket broadcast auth routes. */
export function getBackendOrigin(): string {
  try {
    const base = API_URL.replace(/\/+$/, "");
    const trimmed = base.replace(/\/?api\/v1\/?$/i, "");
    return new URL(trimmed || base).origin;
  } catch {
    return "http://localhost:8000";
  }
}

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

  // FormData must NOT set Content-Type manually — the browser adds the
  // multipart boundary. JSON bodies are stringified and labeled below.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) {
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
    body:
      body === undefined
        ? undefined
        : isFormData
          ? (body as FormData)
          : JSON.stringify(body),
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

/**
 * Fetch a binary/asset response as an object URL.
 *
 * `<img src>` can't carry the Bearer token (or the ngrok skip header), and
 * staff-scoped assets sit behind auth — so pull the bytes through the same
 * request path everything else uses and hand back a blob: URL.
 *
 * Caller owns the URL: revoke it when the component unmounts.
 */
/**
 * Upload with real byte-level progress.
 *
 * fetch() cannot report request progress at all, so a 10 MB venue map would sit
 * behind a spinner with no sense of whether anything is happening. XHR still
 * can, which is the only reason this exists alongside api.upload(). Auth, the
 * ngrok header, and the ApiError shape all mirror request() so callers cannot
 * tell the two apart except by the callback.
 */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path).toString());
    xhr.setRequestHeader("Accept", "application/json");

    try {
      const host = new URL(API_URL.replace(/\/+$/, "")).hostname;
      if (host.endsWith(".ngrok-free.app") || host.endsWith(".ngrok.io")) {
        xhr.setRequestHeader("ngrok-skip-browser-warning", "true");
      }
    } catch {
      /* invalid NEXT_PUBLIC_API_URL — skip */
    }

    const token = getAuthToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    // Never set Content-Type for FormData — the browser adds the multipart boundary.

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        // Not every transport reports a total; fall back to indeterminate
        // rather than inventing a percentage.
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      });
      // The bytes are gone; what remains is the server thinking. Park at 100%
      // so the bar never sits at 99% through a slow sanitize.
      xhr.upload.addEventListener("load", () => onProgress(1));
    }

    xhr.addEventListener("load", () => {
      const json = xhr.responseText ? safeJson(xhr.responseText) : null;

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
        return;
      }

      const body: ApiErrorBody =
        json && typeof json === "object"
          ? (json as ApiErrorBody)
          : { message: xhr.statusText || "Upload failed" };
      reject(new ApiError(body, xhr.status));
    });

    xhr.addEventListener("error", () =>
      reject(new ApiError({ message: "Network error during upload" }, 0)),
    );
    xhr.addEventListener("abort", () =>
      reject(new ApiError({ message: "Upload cancelled" }, 0)),
    );

    xhr.send(form);
  });
}

export async function fetchObjectUrl(pathOrUrl: string): Promise<string> {
  const headers = new Headers({ Accept: "image/svg+xml,*/*" });

  try {
    const host = new URL(API_URL.replace(/\/+$/, "")).hostname;
    if (host.endsWith(".ngrok-free.app") || host.endsWith(".ngrok.io")) {
      headers.set("ngrok-skip-browser-warning", "true");
    }
  } catch {
    /* invalid NEXT_PUBLIC_API_URL — skip */
  }

  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // Accept either an API-relative path or an absolute URL (the public venue-map
  // payload returns absolute asset URLs).
  const target = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : buildUrl(pathOrUrl).toString();

  const res = await fetch(target, { headers });
  if (!res.ok) {
    throw new ApiError({ message: `Could not load asset (${res.status})` }, res.status);
  }

  return URL.createObjectURL(await res.blob());
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body }),
  upload: <T>(path: string, form: FormData, options?: RequestOptions) =>
    request<T>("POST", path, { ...options, body: form }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>("DELETE", path, options),
};

export { API_URL };
