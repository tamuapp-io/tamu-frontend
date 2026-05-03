"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (input: Omit<ToastItem, "id" | "duration"> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (input) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    const toast: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      variant: input.variant,
      duration: input.duration ?? 4000,
    };
    set((state) => ({ toasts: [...state.toasts, toast] }));
    if (toast.duration > 0) {
      setTimeout(() => get().dismiss(id), toast.duration);
    }
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "error" }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, variant: "info" }),
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toasts.length) dismiss(toasts[toasts.length - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toasts, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex flex-col items-end gap-2 px-4 sm:right-4 sm:items-end">
      {toasts.map((t) => {
        const Icon =
          t.variant === "success"
            ? CheckCircle2
            : t.variant === "error"
              ? AlertCircle
              : Info;
        const iconColor =
          t.variant === "success"
            ? "text-emerald-600"
            : t.variant === "error"
              ? "text-rose-600"
              : "text-blue-600";
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-sm gap-3 rounded-lg border border-border bg-card p-3 shadow-lg",
              "data-[state=open]:animate-in data-[state=open]:slide-in-from-top",
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconColor)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{t.title}</p>
              {t.description && (
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
