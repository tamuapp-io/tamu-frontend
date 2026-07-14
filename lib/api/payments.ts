import { api } from "@/lib/api/client";
import type { XenditPaymentSnapshot } from "@/lib/types";

/**
 * Owner/manager-gated management of the tenant's Xendit payment-gateway
 * connection. Credentials are verified + stored encrypted server-side; only a
 * redacted snapshot is ever returned.
 */
export const paymentsApi = {
  xenditSnapshot: () =>
    api.get<{ data: XenditPaymentSnapshot }>("settings/payments/xendit"),

  connectXendit: (payload: { secret_key: string; callback_token: string }) =>
    api.put<{ data: XenditPaymentSnapshot }>("settings/payments/xendit", payload),

  disconnectXendit: () =>
    api.delete<{ data: XenditPaymentSnapshot }>("settings/payments/xendit"),
};
