import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { verifyToken } from '@/lib/mbAuth';
import { forgetCampaignVariant, isVariant } from '@/lib/landingAb';

function auth(req: NextRequest) {
  return verifyToken(req.cookies.get('mr_mb_token')?.value);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = auth(req);
  if (!clientId) return NextResponse.json({ success: false }, { status: 401 });

  const { id } = await params;
  const pixelId = parseInt(id);
  if (isNaN(pixelId)) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const { slug, label, pixel_id, access_token, ad_account_id = null, landing_variant = null, bot_variant = null } = await req.json();
    if (!slug || !label || !pixel_id || !access_token)
      return NextResponse.json({ success: false, message: 'slug, label, pixel_id, access_token required' }, { status: 400 });
    if (landing_variant !== null && !isVariant(landing_variant))
      return NextResponse.json({ success: false, message: 'Invalid landing page' }, { status: 400 });
    if (bot_variant !== null && !isVariant(bot_variant))
      return NextResponse.json({ success: false, message: 'Invalid bot variant' }, { status: 400 });

    const res = await pool.query(
      `UPDATE pixels
       SET slug=$1, label=$2, pixel_id=$3, access_token=$4, ad_account_id=$5, landing_variant=$6, bot_variant=$7, updated_at=NOW()
       WHERE id=$8 AND client_id=$9
       RETURNING id, slug, label, pixel_id, ad_account_id, landing_variant, bot_variant, is_default, client_id`,
      [slug.toLowerCase().trim(), label.trim(), pixel_id.trim(), access_token.trim(), ad_account_id, landing_variant, bot_variant, pixelId, clientId],
    );
    if (res.rowCount === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    forgetCampaignVariant(res.rows[0].slug);
    return NextResponse.json({ success: true, data: res.rows[0] });
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') return NextResponse.json({ success: false, message: 'Slug already exists' }, { status: 409 });
    console.error('mb pixels PUT error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientId = auth(req);
  if (!clientId) return NextResponse.json({ success: false }, { status: 401 });

  const { id } = await params;
  const pixelId = parseInt(id);
  if (isNaN(pixelId)) return NextResponse.json({ success: false, message: 'Invalid id' }, { status: 400 });

  try {
    const res = await pool.query(`DELETE FROM pixels WHERE id=$1 AND client_id=$2 RETURNING id`, [pixelId, clientId]);
    if (res.rowCount === 0) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('mb pixels DELETE error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
