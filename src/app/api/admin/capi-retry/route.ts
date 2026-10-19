import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import pool from '@/lib/db';
import { verifyAdminToken } from '@/lib/adminAuth';

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

// POST /api/admin/capi-retry  { payment_id: number }
export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get('mr_admin')?.value))
    return NextResponse.json({ success: false }, { status: 401 });

  const { payment_id } = await req.json();
  if (!payment_id || isNaN(Number(payment_id)))
    return NextResponse.json({ success: false, message: 'payment_id required' }, { status: 400 });

  const payRes = await pool.query(
    `SELECT pay.id, pay.txn_id, pay.amount, pay.campaign_slug,
            pay.meta_campaign_id, pay.meta_campaign_name,
            pay.fbp, pay.fbc, pay.client_ip, pay.user_agent,
            pay.capi_sent, pay.capi_error,
            u.mobile,
            px.pixel_id, px.access_token
     FROM payments pay
     JOIN users u ON u.id = pay.user_id
     LEFT JOIN pixels px ON px.slug = pay.campaign_slug
     WHERE pay.id = $1 AND pay.status = 'success'`,
    [Number(payment_id)],
  );

  if (payRes.rows.length === 0)
    return NextResponse.json({ success: false, message: 'Payment not found or not success' }, { status: 404 });

  const pay = payRes.rows[0];

  if (!pay.pixel_id || !pay.access_token)
    return NextResponse.json({ success: false, message: 'No pixel linked to this campaign' }, { status: 400 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const ip = pay.client_ip || '127.0.0.1';
  const userAgent = pay.user_agent || 'Unknown';

  const customData: Record<string, unknown> = {
    currency: 'INR',
    value: parseFloat(pay.amount),
  };
  if (pay.meta_campaign_id)   customData.campaign_id   = pay.meta_campaign_id;
  if (pay.meta_campaign_name) customData.campaign_name = pay.meta_campaign_name;

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: pay.txn_id,
      action_source: 'website',
      event_source_url: `${appUrl}/subscription`,
      user_data: {
        client_ip_address: ip,
        client_user_agent: userAgent,
        ph: sha256(normalizePhone(pay.mobile)),
        ...(pay.fbp && { fbp: pay.fbp }),
        ...(pay.fbc && { fbc: pay.fbc }),
      },
      custom_data: customData,
    }],
    access_token: pay.access_token,
  };

  const response = await fetch(
    `https://graph.facebook.com/v23.0/${pay.pixel_id}/events`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
  );
  const result = await response.json();

  const capiError = result.error ? (result.error.message ?? 'CAPI error') : null;

  await pool.query(
    `UPDATE payments SET capi_sent=$1, capi_error=$2, updated_at=NOW() WHERE id=$3`,
    [capiError === null, capiError, pay.id],
  );

  return NextResponse.json({
    success: capiError === null,
    payment_id: pay.id,
    txn_id: pay.txn_id,
    pixel_id: pay.pixel_id,
    mobile: pay.mobile,
    campaign_slug: pay.campaign_slug,
    meta_response: result,
    capi_error: capiError,
  });
}
