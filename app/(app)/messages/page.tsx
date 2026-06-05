"use client";

import { FormEvent, Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { AppTopbar } from "@/components/app-topbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api/client";
import { formatChatListTime, formatTimeInTz } from "@/lib/format";
import {
  useClearWhatsappConversation,
  useSendWhatsappMessage,
  useWhatsappConversation,
  useWhatsappConversations,
  useWhatsappStatus,
} from "@/lib/hooks/use-whatsapp-inbox";
import { useAuthStore } from "@/lib/store/auth-store";
import type { WhatsappConversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WhatsappContactAvatar } from "@/components/whatsapp-contact-avatar";
import { WhatsappGuestProfilePanel } from "@/components/whatsapp-guest-profile-panel";

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

function MessagesPageFallback() {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <AppTopbar
        breadcrumbs={[{ label: "Manage" }, { label: "WhatsApp", current: true }]}
      />
      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
      </div>
    </div>
  );
}

function MessagesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkConversationId = searchParams.get("conversation");
  const timezone = useAuthStore((s) => s.tenant?.timezone ?? "UTC");
  const status = useWhatsappStatus();
  const configured = status.data?.configured === true;
  const sessionDisconnected = configured && status.data?.session_connected === false;

  const conversations = useWhatsappConversations(configured);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const send = useSendWhatsappMessage();
  const clearChat = useClearWhatsappConversation();
  const [draft, setDraft] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const rows = useMemo(() => conversations.data ?? [], [conversations.data]);

  const activeId = useMemo(() => {
    if (pickedId !== null) return pickedId;
    if (deepLinkConversationId) return deepLinkConversationId;
    return rows[0]?.id ?? null;
  }, [pickedId, deepLinkConversationId, rows]);

  const thread = useWhatsappConversation(activeId, configured);

  const activeConversation = useMemo(() => {
    const fromList = rows.find((r) => r.id === activeId);
    const fromThread = thread.data?.conversation;
    if (fromThread?.id === activeId) {
      return fromThread;
    }

    return fromList ?? fromThread ?? null;
  }, [rows, activeId, thread.data?.conversation]);

  /** Include a deep-linked / newly opened thread in the sidebar before list refetch. */
  const sidebarRows = useMemo(() => {
    if (!activeId || rows.some((r) => r.id === activeId)) {
      return rows;
    }
    const fromThread = thread.data?.conversation;
    if (fromThread?.id === activeId) {
      return [fromThread, ...rows];
    }
    return rows;
  }, [rows, activeId, thread.data?.conversation]);

  const threadReady = !!activeConversation;

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!activeId || body === "") return;

    setDraft("");

    send.mutate(
      { conversationId: activeId, body },
      {
        onError: (err) => {
          setDraft(body);
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

  function handleClearChat() {
    if (!activeId) return;

    clearChat.mutate(activeId, {
      onSuccess: () => {
        setConfirmClear(false);
        setDraft("");
        setPickedId(null);
        router.replace("/messages");
        toast.success("Chat cleared");
      },
      onError: (err) => {
        const flat =
          err instanceof ApiError && err.errors
            ? Object.values(err.errors).flat()[0]
            : undefined;
        toast.error(
          "Could not clear chat",
          flat ?? (err instanceof Error ? err.message : undefined),
        );
      },
    });
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden gap-3">
            {sessionDisconnected ? (
              <div className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                Your Wasender session is disconnected. Reconnect WhatsApp in the Wasender
                dashboard, then save your session API key again in Settings → Notifications.
              </div>
            ) : null}
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:grid-cols-[25%_50%_25%]">
            {/* Conversation list — 25% */}
            <aside className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
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
                ) : sidebarRows.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No messages yet. Share your number with guests or paste the
                    webhook URL from Settings into WasenderAPI.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {sidebarRows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setPickedId(row.id)}
                          className={cn(
                            "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                            activeId === row.id && "bg-muted/60",
                          )}
                        >
                          <WhatsappContactAvatar
                            name={displayName(row)}
                            avatarUrl={row.contact_avatar_url}
                            size="sm"
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[15px] font-medium leading-tight">
                                {displayName(row)}
                              </span>
                              {row.last_message_at ? (
                                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                  {formatChatListTime(row.last_message_at, timezone)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[13px] leading-snug text-muted-foreground">
                                {row.last_message_preview ?? displayPhone(row.phone_e164)}
                              </span>
                              {row.unread_count > 0 ? (
                                <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold tabular-nums text-white">
                                  {row.unread_count > 99 ? "99+" : row.unread_count}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>

            {/* Chat thread — 50% */}
            <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              {!activeId ? (
                <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
                  Select a conversation
                </div>
              ) : (
                <>
                  <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="min-w-0">
                      {threadReady ? (
                        <>
                          <h3 className="truncate text-sm font-semibold">
                            {displayName(activeConversation!)}
                          </h3>
                          <p className="truncate text-xs text-muted-foreground">
                            {displayPhone(activeConversation!.phone_e164)}
                          </p>
                        </>
                      ) : (
                        <>
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="mt-1 h-3 w-24" />
                        </>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={clearChat.isPending || !threadReady}
                      onClick={() => setConfirmClear(true)}
                    >
                      <Trash2 className="mr-1.5 size-3.5" aria-hidden />
                      Clear chat
                    </Button>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#e5ddd5] p-3 sm:p-4">
                    {thread.isLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading conversation…
                      </p>
                    ) : thread.isError ? (
                      <p className="text-sm text-destructive">
                        Could not load this conversation. You can still try sending a message below.
                      </p>
                    ) : (thread.data?.messages ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No messages yet. Send the first message to this guest. They must
                        have WhatsApp on this number; it may take a moment to appear in
                        your phone app for new contacts.
                      </p>
                    ) : (
                      (thread.data?.messages ?? []).map((msg) => {
                        const outbound = msg.direction === "outbound";
                        const pending = outbound && (msg.status === "pending" || msg.status == null);
                        const failed = outbound && msg.status === "failed";
                        return (
                          <div
                            key={msg.id}
                            className={cn("mb-1 flex", outbound ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] rounded-lg px-2 py-1.5 text-sm shadow-sm",
                                outbound
                                  ? "rounded-tr-none bg-[#d9fdd3] text-foreground"
                                  : "rounded-tl-none bg-white text-foreground ring-1 ring-border/60",
                                pending && "opacity-70",
                                failed && "opacity-90 ring-1 ring-destructive/40",
                              )}
                            >
                              <div className="flex flex-wrap items-end gap-x-2 gap-y-0.5">
                                <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                                  {msg.body.startsWith("[Image]") ? (
                                    <span className="italic opacity-90">{msg.body}</span>
                                  ) : (
                                    msg.body
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 self-end text-[10px] leading-none tabular-nums",
                                    outbound ? "text-emerald-900/55" : "text-muted-foreground",
                                  )}
                                >
                                  {failed
                                    ? "Failed"
                                    : pending
                                      ? "…"
                                      : msg.sent_at
                                        ? formatTimeInTz(msg.sent_at, timezone)
                                        : null}
                                </span>
                              </div>
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
                      placeholder="Type a message…"
                      rows={2}
                      className="min-h-11 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                      disabled={draft.trim() === ""}
                      aria-label="Send message"
                    >
                      <Send className="size-4" />
                    </Button>
                  </form>
                </>
              )}
            </section>

            {/* Guest profile — 25% */}
            <WhatsappGuestProfilePanel
              conversation={activeConversation}
              loading={!!activeId && thread.isLoading && !threadReady}
              timezone={timezone}
            />
          </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              All messages with{" "}
              {activeConversation ? displayName(activeConversation) : "this guest"}{" "}
              will be removed from your inbox. This does not delete the
              conversation on WhatsApp — only Tamu&apos;s copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearChat.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={clearChat.isPending}
              onClick={handleClearChat}
            >
              Clear chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesPageFallback />}>
      <MessagesPageContent />
    </Suspense>
  );
}
