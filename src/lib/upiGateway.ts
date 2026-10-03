// Server-only payment gateway switch — PAYMENT_PROVIDER=sabpaisa / meraotp use those hosted pages,
// otherwise the built-in Paytm Business UPI flow (link + QR made here, status straight from Paytm)
import { createMeraotpOrder, getMeraotpOrderStatus, MERAOTP_ORDER_PREFIX } from './meraotpPay';
import { createPaytmOrder, getPaytmOrderStatus } from './paytmUpi';
import { createSabpaisaOrder, getSabpaisaOrderStatus } from './sabpaisa';

export interface UpiOrder {
  orderId: string;
  gatewayOrderId?: string;
  amount: number;
  payeeName: string;
  vpa: string;
  upiLink: string;
  qrCode: string;
  // Hosted checkout page (SabPaisa) — the client redirects there instead of showing UPI options
  checkoutUrl?: string;
  expiresAt: string | null;
}

export interface UpiOrderStatus {
  paid: boolean;
  failed: boolean;
  status: string;
  gatewayTxnId: string | null;
  amount: number;
  raw: object;
}

export function createUpiOrder(
  amount: number,
  note: string,
  customer: { userId: number; mobile: string },
): Promise<UpiOrder | { error: string }> {
  switch (process.env.PAYMENT_PROVIDER) {
    case 'sabpaisa':
      return createSabpaisaOrder(amount, note, customer);
    case 'meraotp':
      return createMeraotpOrder(amount, note);
    default:
      return createPaytmOrder(amount, note);
  }
}

// Routed by the order id's own prefix, so orders created before a provider switch still settle
export function getUpiOrderStatus(orderId: string, expectedAmount: number): Promise<UpiOrderStatus | null> {
  if (orderId.startsWith('KAAMA_')) return getSabpaisaOrderStatus(orderId);
  if (orderId.startsWith(MERAOTP_ORDER_PREFIX)) return getMeraotpOrderStatus(orderId, expectedAmount);
  return getPaytmOrderStatus(orderId);
}
