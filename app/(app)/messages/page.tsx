"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { formatTimeInTz } from "@/lib/format";
import {
  useSendWhatsappMessage,
  useWhatsappConversation,
  useWhatsappConversations,
  useWhatsappStatus,
} from "@/lib/hooks/use-whatsapp-inbox";
import { useAuthStore } from "@/lib/store/auth-store";
import type { WhatsappConversation } from "@/lib/types";
import { cn } from "@/lib/utils";

function displayPhone(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

function displayName(row: WhatsappConversation): string {
  return row.contact_name?.trim() || row.guest?.name?.trim() || displayPhone(row.phone_e164);
}

function NotConfiguredState() {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center shadow-xs">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <MessageCircle className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">Connect WhatsApp</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Add your WasenderAPI session key in Settings → Notifications to receive
        and reply to guest messages from your restaurant number.
      </p>
      <Button asChild className="mt-6">
        <Link href="/settings">Open Settings</Link>
      </Button>
    </Card>
  );
}

export default function MessagesPage() {
  const timezone = useAuthStore((s) => s.tenant?.timezone ?? "UTC");
  const status = useWhatsappStatus();
  const configured = status.data?.configured === true;

  const conversations = useWhatsappConversations(configured);
  const [activeId, setActiveId] = useState<string | null>(null);
  const thread = useWhatsappConversation(activeId, configured);
  const send = useSendWhatsappMessage();
  const [draft, setDraft] = useState("");

  const rows = conversations.data ?? [];

  useEffect(() => {
    if (rows.length === 0) {
      setActiveId(null);
      return;
    }
    if (activeId == null || !rows.some((r) => r.id === activeId)) {
      setActiveId(rows[0]!.id);
    }
  }, [rows, activeId]);

  const activeConversation = useMemo(
    () => rows.find((r) => r.id === activeId) ?? thread.data?.conversation ?? null,
    [rows, activeId, thread.data?.conversation],
  );

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!activeId || body === "") return;

    send.mutate(
      { conversationId: activeId, body },
      {
        onSuccess: () => setDraft(""),
        onError: (err) => {
          const flat =
            err instanceof ApiError && err.errors
              ? Object.values(err.errors).flat()[0]
              : undefined;
          toast.error(
            "Could not send message",
            flat ?? (err instanceof Error ? err.message : undefined),
          );
        },
      },
    );
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "WhatsApp", current: true }]}
      />

      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
        {status.isLoading ? (
          <Skeleton className="min-h-0 flex-1 rounded-xl" />
        ) : !configured ? (
          <div className="flex flex-1 items-center justify-center">
            <NotConfiguredState />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs md:flex-row">
            {/* Conversation list */}
            <aside className="flex min-h-0 flex-[2] flex-col border-b border-border md:w-80 md:flex-none md:shrink-0 md:border-b-0 md:border-r">
              <div className="shrink-0 border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Conversations</h2>
                <p className="text-xs text-muted-foreground">
                  Guest messages to your WhatsApp number
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {conversations.isLoading ? (
                  <div className="space-y-2 p-3">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : rows.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No messages yet. Share your number with guests or paste the
                    webhook URL from Settings into WasenderAPI.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(row.id)}
                          className={cn(
                            "flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                            activeId === row.id && "bg-muted/60",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {displayName(row)}
                            </span>
                            {row.unread_count > 0 ? (
                              <Badge variant="default" className="shrink-0 tabular-nums">
                                {row.unread_count}
                              </Badge>
                            ) : null}
                          </div>
                          <span className="truncate text-xs text-muted-foreground">
                            {row.last_message_preview ?? displayPhone(row.phone_e164)}
                          </span>
                          {row.last_message_at ? (
                            <span className="text-[11px] text-muted-foreground tabular-nums">
                              {formatTimeInTz(row.last_message_at, timezone)}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>

            {/* Thread */}
            <section className="flex min-h-0 min-w-0 flex-[3] flex-col overflow-hidden md:flex-1">
              {!activeId || !activeConversation ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                  Select a conversation
                </div>
              ) : (
                <>
                  <header className="shrink-0 border-b border-border px-4 py-3">
                    <h3 className="text-sm font-semibold">
                      {displayName(activeConversation)}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {displayPhone(activeConversation.phone_e164)}
                    </p>
                  </header>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
                    {thread.isLoading ? (
                      <Skeleton className="h-24 w-2/3" />
                    ) : (
                      (thread.data?.messages ?? []).map((msg) => {
                        const outbound = msg.direction === "outbound";
                        return (
                          <div
                            key={msg.id}
                            className={cn("flex", outbound ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
                                outbound
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground",
                              )}
                            >
                              {msg.body}
                              {msg.sent_at ? (
                                <div
                                  className={cn(
                                    "mt-1 text-[10px] tabular-nums opacity-70",
                                    outbound ? "text-primary-foreground" : "text-muted-foreground",
                                  )}
                                >
                                  {formatTimeInTz(msg.sent_at, timezone)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form
                    onSubmit={handleSend}
                    className="flex shrink-0 gap-2 border-t border-border p-4"
                  >
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type a reply…"
                      rows={2}
                      disabled={send.isPending}
                      className="min-h-[2.75rem] flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend(e);
                        }
                      }}
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={send.isPending || draft.trim() === ""}
                      aria-label="Send message"
                    >
                      <Send className="size-4" />
                    </Button>
                  </form>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
