"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateInTz } from "@/lib/format";
import type { GuestProfile, WhatsappConversation } from "@/lib/types";
import {
  guestBookingLabel,
  isReturningGuest,
  ReturningGuestBadge,
} from "@/components/returning-guest-badge";
import { WhatsappContactAvatar } from "@/components/whatsapp-contact-avatar";

function displayPhone(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function displayName(conversation: WhatsappConversation): string {
  return (
    conversation.contact_name?.trim() ||
    conversation.guest?.name?.trim() ||
    displayPhone(conversation.phone_e164)
  );
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function GuestStats({ guest }: { guest: GuestProfile }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      <ProfileField label="Bookings" value={guest.total_bookings ?? 0} />
      <ProfileField label="Visits" value={guest.visit_count ?? 0} />
      <ProfileField label="No-shows" value={guest.no_show_count ?? 0} />
      <ProfileField
        label="Status"
        value={
          isReturningGuest(guest.total_bookings) ? (
            <span className="font-medium">Returning guest</span>
          ) : (
            <span className="text-muted-foreground">First-time</span>
          )
        }
      />
    </dl>
  );
}

type WhatsappGuestProfilePanelProps = {
  conversation: WhatsappConversation | null;
  loading?: boolean;
  timezone: string;
};

export function WhatsappGuestProfilePanel({
  conversation,
  loading = false,
  timezone,
}: WhatsappGuestProfilePanelProps) {
  if (loading) {
    return (
      <aside className="flex min-h-0 flex-col border-t border-border lg:border-t-0 lg:border-l">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="space-y-4 p-4">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </aside>
    );
  }

  if (!conversation) {
    return (
      <aside className="hidden min-h-0 flex-col border-t border-border lg:flex lg:border-t-0 lg:border-l">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Guest profile</h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a conversation to view guest details
        </div>
      </aside>
    );
  }

  const guest = conversation.guest ?? null;
  const name = displayName(conversation);

  return (
    <aside className="hidden min-h-0 flex-col overflow-hidden border-t border-border lg:flex lg:border-t-0 lg:border-l">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Guest profile</h2>
        <p className="text-xs text-muted-foreground">CRM details for this chat</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <div className="flex flex-col items-center text-center">
          <WhatsappContactAvatar
            name={name}
            avatarUrl={conversation.contact_avatar_url}
            size="lg"
            className="size-20 text-lg"
          />
          <h3 className="mt-3 text-base font-semibold">{name}</h3>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {guest ? (
              <ReturningGuestBadge totalBookings={guest.total_bookings} />
            ) : null}
            {guest?.is_blacklisted ? (
              <Badge variant="warning">Blacklisted</Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-6 space-y-5">
          <ProfileField
            label="Phone"
            value={displayPhone(conversation.phone_e164)}
          />

          {guest ? (
            <>
              {guest.email ? (
                <ProfileField label="Email" value={guest.email} />
              ) : null}

              <div className="rounded-lg border border-border bg-muted/30 p-3">
                {/* <p className="mb-3 text-xs font-medium text-muted-foreground">
                  {guestBookingLabel(guest.total_bookings)}
                </p> */}
                <GuestStats guest={guest} />
              </div>

              {guest.last_visit_at ? (
                <ProfileField
                  label="Last visit"
                  value={formatDateInTz(guest.last_visit_at, timezone)}
                />
              ) : null}

              {guest.birthday_month ? (
                <ProfileField
                  label="Birthday month"
                  value={new Date(2000, guest.birthday_month - 1, 1).toLocaleString(
                    undefined,
                    { month: "long" },
                  )}
                />
              ) : null}

              {guest.tags && guest.tags.length > 0 ? (
                <div className="space-y-1.5">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Tags
                  </dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {guest.tags.map((tag) => (
                      <Badge key={tag} variant="muted" className="text-[11px]">
                        {tag}
                      </Badge>
                    ))}
                  </dd>
                </div>
              ) : null}

              {guest.notes?.trim() ? (
                <ProfileField
                  label="Notes"
                  value={
                    <span className="whitespace-pre-wrap text-sm leading-relaxed">
                      {guest.notes}
                    </span>
                  }
                />
              ) : null}

              {guest.created_at ? (
                <ProfileField
                  label="Guest since"
                  value={formatDateInTz(guest.created_at, timezone)}
                />
              ) : null}

              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/guests">
                  <UserRound className="mr-1.5 size-3.5" aria-hidden />
                  Open guests list
                </Link>
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              <p>No linked guest profile yet.</p>
              <p className="mt-2 text-xs">
                This number is not matched to a guest in your CRM. Details will
                appear here once they book or are added under Guests.
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
