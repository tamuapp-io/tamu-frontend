"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2);
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`;
}

type Props = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function WhatsappContactAvatar({ name, avatarUrl, size = "md", className }: Props) {
  const label = initials(name);

  return (
    <Avatar size={size} className={className}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Wasender CDN URL
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <AvatarFallback>{label}</AvatarFallback>
      )}
    </Avatar>
  );
}
