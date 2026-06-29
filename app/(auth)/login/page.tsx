"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth-store";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";

export default function LoginPage() {
  const router = useRouter();
  const login = useLogin();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (hydrated && token) router.replace("/home");
  }, [hydrated, token, router]);

  const fieldErrors = (login.error instanceof ApiError && login.error.errors) || {};
  const formError =
    login.error instanceof ApiError && !login.error.errors
      ? login.error.message
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({
        email: email.trim(),
        password,
        device_name: "tamu-dashboard",
      });
      toast.success("Welcome back");
      router.replace("/home");
    } catch {
      // shown inline
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Tamu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use the email you registered with your restaurant.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={!!fieldErrors.email}
          />
          {fieldErrors.email?.[0] && (
            <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={!!fieldErrors.password}
          />
          {fieldErrors.password?.[0] && (
            <p className="text-xs text-destructive">{fieldErrors.password[0]}</p>
          )}
        </div>

        {formError && (
          <p
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {formError}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={login.isPending}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Tamu?{" "}
        <Link href="/register" className="font-medium text-foreground hover:underline">
          Create a restaurant account
        </Link>
      </p>
    </div>
  );
}
