"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { authApi } from "@/lib/api/auth";

/**
 * Consumes a support-impersonation link from the platform admin panel.
 * The bearer token arrives in the URL fragment (`#token=…`) so it never
 * reaches the server or logs; we exchange it for the session and redirect.
 */
export default function ImpersonatePage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    // Strip the token from the address bar immediately.
    window.history.replaceState(null, "", window.location.pathname);

    useAuthStore.setState({ token, hydrated: true });

    authApi
      .me()
      .then((res) => {
        useAuthStore.getState().setSession({
          token,
          user: res.data.user,
          tenant: res.data.tenant,
        });
        router.replace("/home");
      })
      .catch(() => {
        useAuthStore.getState().clear();
        router.replace("/login");
      });
  }, [router]);

  return (
    <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
      Signing you in…
    </div>
  );
}
