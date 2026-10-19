import { verifyAdminToken } from '@/lib/adminAuth';
import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

const unauthorized = () => NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

interface BotConfig {
  enabled: boolean;
  mode: 'html' | 'redirect' | 'landing_a' | 'landing_b';
  redirect_url: string;
  html_content: string;
}

const DEFAULT: BotConfig = {
  enabled: false,
  mode: 'html',
  redirect_url: '',
  html_content: '',
};

async function getConfig(): Promise<BotConfig> {
  const res = await pool.query(`SELECT value FROM app_settings WHERE key = 'bot_cloaking'`);
  if (res.rows.length) return { ...DEFAULT, ...(res.rows[0].value as Partial<BotConfig>) };
  return DEFAULT;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get('mr_admin')?.value)) return unauthorized();
  try {
    return NextResponse.json({ success: true, config: await getConfig() });
  } catch (err) {
    console.error('bot-config GET error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get('mr_admin')?.value)) return unauthorized();
  try {
    const body = await req.json() as Partial<BotConfig>;
    const cur = await getConfig();
    const next: BotConfig = { ...cur };

    if (typeof body.enabled === 'boolean') next.enabled = body.enabled;
    if (body.mode !== undefined) {
      if (!['html', 'redirect', 'landing_a', 'landing_b'].includes(body.mode)) {
        return NextResponse.json({ success: false, message: 'Invalid mode' }, { status: 400 });
      }
      next.mode = body.mode;
    }
    if (body.redirect_url !== undefined) next.redirect_url = String(body.redirect_url).trim();
    if (body.html_content !== undefined) next.html_content = String(body.html_content);

    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('bot_cloaking', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [JSON.stringify(next)],
    );

    return NextResponse.json({ success: true, config: next });
  } catch (err) {
    console.error('bot-config PUT error:', err);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
