import { api } from "@/lib/api/client";
import type {
  PaymentGatewaysSnapshot,
  PaymentProvider,
  XenditPaymentSnapshot,
} from "@/lib/types";

/**
 * Owner/manager-gated management of the venue's payment gateways.
 *
 * A venue may hold credentials for more than one gateway — so switching back
 * doesn't mean re-pasting keys — but exactly one is active at a time. All
 * credentials are verified and stored encrypted server-side; only redacted
 * snapshots ever come back.
 */
export const paymentsApi = {
  /** Every supported gateway plus which one guests actually pay through. */
  gateways: () =>
    api.get<{ data: PaymentGatewaysSnapshot }>("settings/payments/gateways"),

  activateGateway: (provider: PaymentProvider) =>
    api.put<{ data: PaymentGatewaysSnapshot }>("settings/payments/gateways/active", {
      provider,
    }),

  connectXendit: (payload: { secret_key: string; callback_token: string }) =>
    api.put<{ data: XenditPaymentSnapshot }>("settings/payments/xendit", payload),

  disconnectXendit: () =>
    api.delete<{ data: XenditPaymentSnapshot }>("settings/payments/xendit"),

  connectDoku: (payload: { client_id: string; secret_key: string }) =>
    api.put<{ data: PaymentGatewaysSnapshot }>("settings/payments/doku", payload),

  disconnectDoku: () =>
    api.delete<{ data: PaymentGatewaysSnapshot }>("settings/payments/doku"),
};
