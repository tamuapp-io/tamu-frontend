"use client";

import Link from "next/link";
import { CalendarClock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GuestStats, ProfileField } from "@/components/guest-profile-fields";
import { ReturningGuestBadge } from "@/components/returning-guest-badge";
import { WhatsappContactAvatar } from "@/components/whatsapp-contact-avatar";
import { formatDateInTz } from "@/lib/format";
import type { GuestProfile } from "@/lib/types";

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface CrmContactPanelProps {
  guest: GuestProfile | null;
  timezone: string;
  /** Consent toggles mirror the table so either surface can flip them. */
  onToggleConsent?: (
    id: string,
    payload: { whatsapp_consent?: boolean; email_consent?: boolean },
  ) => void;
  consentPending?: boolean;
}

/**
 * Guest detail card for the CRM contacts sidebar — the same profile layout the
 * WhatsApp inbox shows, keyed off a GuestProfile instead of a conversation.
 * Renders content only; the caller wraps it in a desktop aside or a mobile sheet.
 */
export function CrmContactPanel({
  guest,
  timezone,
  onToggleConsent,
  consentPending = false,
}: CrmContactPanelProps) {
  if (!guest) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a contact to view their details.
      </div>
    );
  }

  const birthdayMonth = guest.birthday_month ? MONTHS_LONG[guest.birthday_month - 1] : null;
  const birthday = birthdayMonth
    ? `${birthdayMonth}${guest.birthday_day ? ` ${guest.birthday_day}` : ""}`
    : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
      <div className="flex flex-col items-center text-center">
        <WhatsappContactAvatar
          name={guest.name ?? "Guest"}
          size="lg"
          className="size-20 text-lg"
        />
        <h3 className="mt-3 text-base font-semibold">{guest.name ?? "Guest"}</h3>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          <ReturningGuestBadge totalBookings={guest.total_bookings} />
          {(guest.no_show_count ?? 0) >= 2 ? (
            <Badge variant="warning">No-show risk</Badge>
          ) : null}
          {guest.is_blacklisted ? <Badge variant="warning">Blacklisted</Badge> : null}
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {guest.phone ? <ProfileField label="Phone" value={guest.phone} /> : null}
        {guest.email ? <ProfileField label="Email" value={guest.email} /> : null}

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <GuestStats guest={guest} />
        </div>

        {guest.last_visit_at ? (
          <ProfileField
            label="Last visit"
            value={
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden />
                {formatDateInTz(guest.last_visit_at, timezone)}
              </span>
            }
          />
        ) : null}

        {birthday ? <ProfileField label="Birthday" value={birthday} /> : null}

        {/* Marketing consent — same source of truth as the table row. */}
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Marketing consent
          </p>
          <div className="flex items-center justify-between text-sm">
            <span>WhatsApp</span>
            <Switch
              checked={guest.whatsapp_consent === true}
              disabled={!guest.phone || consentPending || !onToggleConsent}
              onCheckedChange={(v) => onToggleConsent?.(guest.id, { whatsapp_consent: v })}
              aria-label="WhatsApp marketing consent"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Email</span>
            <Switch
              checked={guest.email_consent === true}
              disabled={!guest.email || consentPending || !onToggleConsent}
              onCheckedChange={(v) => onToggleConsent?.(guest.id, { email_consent: v })}
              aria-label="Email marketing consent"
            />
          </div>
        </div>

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
              <span className="whitespace-pre-wrap text-sm leading-relaxed">{guest.notes}</span>
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
            Open in guests list
          </Link>
        </Button>
      </div>
    </div>
  );
}
