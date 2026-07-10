"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VenueTimezonePicker } from "@/components/venue-timezone-picker";
import { getBrowserSuggestedTimezone } from "@/lib/venue-timezones";
import { useRegister } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth-store";
import { ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/toaster";

const CATEGORY_OPTIONS = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "spa", label: "Spa" },
  { value: "wellness", label: "Wellness" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const register = useRegister();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s.hydrated);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    restaurant_name: "",
    category: "restaurant",
  });
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    const z = getBrowserSuggestedTimezone();
    setTimezone(z ?? "Asia/Jakarta");
  }, []);

  useEffect(() => {
    if (hydrated && token) router.replace("/home");
  }, [hydrated, token, router]);

  const fieldErrors =
    (register.error instanceof ApiError && register.error.errors) || {};
  const formError =
    register.error instanceof ApiError && !register.error.errors
      ? register.error.message
      : null;

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await register.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        restaurant_name: form.restaurant_name.trim(),
        timezone: timezone.trim(),
        category: form.category,
      });
      toast.success("Venue ready", "We've created your tenant — let's get set up.");
      router.replace("/home");
    } catch {
      // shown inline
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create your venue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          You&apos;ll be the owner of a fresh tenant. Your team can be invited later.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="category">Business type</Label>
          <select
            id="category"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
            value={form.category}
            onChange={(e) => update("category", e.target.value)}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {fieldErrors.category?.[0] && (
            <p className="text-xs text-destructive">{fieldErrors.category[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="restaurant">Venue name</Label>
          <Input
            id="restaurant"
            placeholder="e.g. Sajiwa SCBD"
            required
            value={form.restaurant_name}
            onChange={(e) => update("restaurant_name", e.target.value)}
            invalid={!!fieldErrors.restaurant_name}
          />
          {fieldErrors.restaurant_name?.[0] && (
            <p className="text-xs text-destructive">
              {fieldErrors.restaurant_name[0]}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reg-tz">Venue timezone</Label>
          <VenueTimezonePicker
            triggerId="reg-tz"
            disabled={register.isPending}
            value={timezone}
            onChange={setTimezone}
            showSuggestFromBrowser
          />
          {fieldErrors.timezone?.[0] && (
            <p className="text-xs text-destructive">{fieldErrors.timezone[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            placeholder="Anya Bismantara"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            invalid={!!fieldErrors.name}
          />
          {fieldErrors.name?.[0] && (
            <p className="text-xs text-destructive">{fieldErrors.name[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            placeholder="anya@sajiwa.id"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
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
            type="password"
            placeholder="Minimum 8 characters"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
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
          disabled={register.isPending || !timezone.trim()}
        >
          {register.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
