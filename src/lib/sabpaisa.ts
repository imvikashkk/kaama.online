// Server-only client for SabPaisa hosted checkout — credentials come from env and are never exposed to the browser
import crypto from 'crypto';
import type { UpiOrder, UpiOrderStatus } from './upiGateway';

const PROD_URL = 'https://merchant-api.sabpaisa.in';
const STAGING_URL = 'https://staging-sb-merchant-api.sabpaisa.in';
// SabPaisa checkout sessions stay open for 30 minutes — the pay sheet counts down to this
const EXPIRY_MINUTES = 30;

const cfg = () => ({
  baseUrl: (process.env.SABPAISA_BASE_URL || (process.env.SABPAISA_ENV === 'staging' ? STAGING_URL : PROD_URL)).replace(/\/+$/, ''),
  merchantId: process.env.SABPAISA_MERCHANT_ID ?? '',
  apiKey: process.env.SABPAISA_API_KEY ?? '',
  secretKey: process.env.SABPAISA_SECRET_KEY ?? '',
  payeeName: process.env.SABPAISA_PAYEE_NAME ?? 'Kaama',
});

const headers = (c: ReturnType<typeof cfg>) => ({
  'Content-Type': 'application/json',
  'X-Api-Key': c.apiKey,
  'X-Merchant-Id': c.merchantId,
});

// HMAC-SHA256 over merchantId|merchantTxnId|amount|currency|timestamp → 64-char lowercase hex
function checksum(secret: string, parts: (string | number)[]) {
  return crypto.createHmac('sha256', secret).update(parts.join('|')).digest('hex');
}

export async function createSabpaisaOrder(
  amount: number,
  note: string,
  customer: { userId: number; mobile: string },
): Promise<UpiOrder | { error: string }> {
  const c = cfg();
  if (!c.merchantId || !c.apiKey || !c.secretKey) {
    console.error('SabPaisa env missing (SABPAISA_MERCHANT_ID / SABPAISA_API_KEY / SABPAISA_SECRET_KEY)');
    return { error: 'Payment init failed' };
  }

  // Doubles as our txn_id — alphanumeric + _ only, unique per attempt
  const merchantTxnId = `KAAMA_${customer.userId}_${Date.now()}${crypto.randomInt(100, 999)}`;
  const amountPaise = Math.round(amount * 100);
  const timestamp = Math.floor(Date.now() / 1000);
  const mobile = customer.mobile.replace(/\D/g, '').slice(-10);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

  try {
    const res = await fetch(`${c.baseUrl}/api/v2/payments`, {
      method: 'POST',
      headers: { ...headers(c), 'X-Idempotency-Key': merchantTxnId },
      body: JSON.stringify({
        merchantId: c.merchantId,
        merchantTxnId,
        amount: amountPaise,
        currency: 'INR',
        timestamp,
        // Users only sign up with a mobile number — SabPaisa requires name/email, so derive them
        customerName: 'Kaama User',
        customerEmail: `${mobile || customer.userId}@kaama.online`,
        customerPhone: mobile,
        description: note.slice(0, 500),
        // Checkout lands here inside the iframe once the payment settles
        returnUrl: `${appUrl}/payment/return`,
        udf1: String(customer.userId),
        checksum: checksum(c.secretKey, [c.merchantId, merchantTxnId, amountPaise, 'INR', timestamp]),
      }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success || !data.checkoutUrl) {
      console.error('SabPaisa create failed:', res.status, data.errorCode ?? '', data.errorMessage ?? '', data.traceId ?? '');
      return { error: 'Payment init failed' };
    }

    return {
      orderId: merchantTxnId,
      gatewayOrderId: String(data.paymentId ?? ''),
      amount: (Number(data.amount) || amountPaise) / 100,
      payeeName: c.payeeName,
      vpa: '',
      upiLink: '',
      qrCode: '',
      checkoutUrl: String(data.checkoutUrl),
      // SabPaisa's own expiresAt carries no timezone, so derive it here
      expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000).toISOString(),
    };
  } catch (err) {
    console.error('SabPaisa create error:', err);
    return { error: 'Payment init failed' };
  }
}

const PAID_STATUSES = ['SUCCESS'];
const FAILED_STATUSES = ['FAILED', 'EXPIRED', 'TIMEOUT', 'CANCELLED'];

export async function getSabpaisaOrderStatus(merchantTxnId: string): Promise<UpiOrderStatus | null> {
  const c = cfg();
  try {
    const res = await fetch(`${c.baseUrl}/api/v2/payments/enquiry`, {
      method: 'POST',
      headers: headers(c),
      body: JSON.stringify({ clientCode: c.merchantId, merchantTxnId }),
      cache: 'no-store',
    });
    // Enquiry responses carry no `success` flag — a matching merchantTxnId + status is the signal
    const d = await res.json().catch(() => null);
    if (!res.ok || !d?.status || d.merchantTxnId !== merchantTxnId) return null;
    const status = String(d.status).toUpperCase();
    return {
      paid: PAID_STATUSES.includes(status),
      failed: FAILED_STATUSES.includes(status),
      status,
      gatewayTxnId: d.bankRrn ?? d.bankTxnId ?? d.txnId ?? null,
      // paidAmount is in rupees; amountPaise is the fallback
      amount: Number(d.paidAmount) || (Number(d.amountPaise) || 0) / 100,
      raw: d,
    };
  } catch (err) {
    console.error('SabPaisa status error:', err);
    return null;
  }
}
