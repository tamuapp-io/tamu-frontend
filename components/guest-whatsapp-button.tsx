"use client";

import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { useOpenWhatsappConversation, useWhatsappStatus } from "@/lib/hooks/use-whatsapp-inbox";
import { cn } from "@/lib/utils";

type GuestWhatsappButtonProps = {
  phone?: string | null;
  guestId?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "icon";
  variant?: "outline" | "ghost" | "default";
  className?: string;
  /** When true, only render an icon (for table rows). */
  iconOnly?: boolean;
  onClick?: (event: React.MouseEvent) => void;
};

export function GuestWhatsappButton({
  phone,
  guestId,
  name,
  size = "sm",
  variant = "outline",
  className,
  iconOnly = false,
  onClick,
}: GuestWhatsappButtonProps) {
  const router = useRouter();
  const status = useWhatsappStatus();
  const open = useOpenWhatsappConversation();

  const trimmed = phone?.trim() ?? "";
  const configured = status.data?.configured === true;
  const disabled = trimmed === "" || !configured || open.isPending;

  const title = !trimmed
    ? "No phone number on file"
    : !configured
      ? "Connect WhatsApp in Settings → Notifications"
      : "Open WhatsApp chat";

  async function handleClick(event: React.MouseEvent) {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;

    open.mutate(
      {
        phone: trimmed,
        guest_id: guestId ?? undefined,
        name: name ?? undefined,
      },
      {
        onSuccess: (res) => {
          router.push(`/messages?conversation=${res.data.id}`);
        },
        onError: (err) => {
          const flat =
            err instanceof ApiError && err.errors
              ? Object.values(err.errors).flat()[0]
              : undefined;
          toast.error(
            "Could not open WhatsApp chat",
            flat ?? (err instanceof Error ? err.message : undefined),
          );
        },
      },
    );
  }

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant={variant}
        size="icon"
        className={cn("size-8 shrink-0", className)}
        disabled={disabled}
        title={title}
        aria-label={title}
        onClick={handleClick}
      >
        <MessageCircle className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled}
      title={title}
      onClick={handleClick}
    >
      <MessageCircle className="mr-1.5 size-3.5" aria-hidden />
      WhatsApp
    </Button>
  );
}
