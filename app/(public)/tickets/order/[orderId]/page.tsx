"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { TamuLogo } from "@/components/tamu-brand";
import { Card } from "@/components/ui/card";
import { publicEventsApi } from "@/lib/api/public-events";
import { ApiError } from "@/lib/api/client";
import type { TicketOrder } from "@/lib/types";

/**
 * Post-checkout landing page. Xendit returns the guest here after a hosted
 * payment; ticket issuance happens asynchronously in the webhook, so we poll
 * the order until it settles, then forward to the ticket wallet.
 */
export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const router = useRouter();

  const query = useQuery({
    queryKey: ["public", "order", orderId],
    queryFn: async () => (await publicEventsApi.order(orderId)).data,
    retry: false,
    // Keep polling while the order is still pending payment/issuance.
    refetchInterval: (q) => {
      const order = q.state.data as TicketOrder | undefined;
      if (!order) return 2000;
      return isSettled(order) ? false : 2000;
    },
  });

  const order = query.data;
  const firstCode = order?.tickets?.[0]?.code;

  // Once tickets are issued, forward to the ticket wallet.
  useEffect(() => {
    if (order && order.status === "paid" && firstCode) {
      router.replace(`/tickets/${firstCode}`);
    }
  }, [order, firstCode, router]);

  return (
    <div className="mx-auto max-w-md p-4 pt-16 sm:p-8">
      <Card className="p-8 text-center">{renderBody()}</Card>

      <footer className="mt-10 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
        <TamuLogo height={12} className="opacity-70" />
        <span>Tickets powered by Tamu</span>
      </footer>
    </div>
  );

  function renderBody() {
    if (query.isError) {
      const notFound = query.error instanceof ApiError && query.error.status === 404;
      return (
        <Status
          tone="error"
          title={notFound ? "Order not found" : "Something went wrong"}
          message={
            notFound
              ? "This order link is invalid or has expired."
              : "We couldn't check your order. Please refresh in a moment."
          }
        />
      );
    }

    if (!order) {
      return <Status tone="pending" title="Loading your order" message="One moment…" />;
    }

    if (order.status === "cancelled" || order.payment?.status === "expired") {
      return (
        <Status
          tone="error"
          title="Payment not completed"
          message="Your payment expired or was cancelled, so no tickets were issued. Head back to the event page to start again."
        />
      );
    }

    if (order.status === "paid" && firstCode) {
      return <Status tone="success" title="Payment received!" message="Taking you to your tickets…" />;
    }

    // Paid but tickets not visible yet, or still pending — keep waiting.
    return (
      <Status
        tone="pending"
        title="Confirming your payment"
        message="This usually takes just a few seconds. Please keep this page open."
      />
    );
  }
}

/** A settled order needs no more polling. */
function isSettled(order: TicketOrder): boolean {
  if (order.status === "cancelled" || order.payment?.status === "expired") return true;
  return order.status === "paid" && (order.tickets?.length ?? 0) > 0;
}

function Status({
  tone,
  title,
  message,
  action,
}: {
  tone: "pending" | "success" | "error";
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <>
      <div
        className={
          tone === "success"
            ? "mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700"
            : tone === "error"
              ? "mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-700"
              : "mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground"
        }
      >
        {tone === "success" ? (
          <CheckCircle2 className="h-6 w-6" />
        ) : tone === "error" ? (
          <AlertCircle className="h-6 w-6" />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin" />
        )}
      </div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      {action}
    </>
  );
}
