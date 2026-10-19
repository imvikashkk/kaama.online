import { redirect } from 'next/navigation';
import pool from '@/lib/db';
import LandingPage from '@/components/LandingPage';
import AuthPage from '@/components/Auth';
import type { Variant } from '@/lib/landingAb';

interface BotConfig {
  enabled: boolean;
  mode: 'html' | 'redirect' | 'landing_a' | 'landing_b';
  redirect_url: string;
  html_content: string;
}

const DEFAULT_CONFIG: BotConfig = {
  enabled: false,
  mode: 'html',
  redirect_url: '',
  html_content: '',
};

async function getBotConfig(): Promise<BotConfig> {
  try {
    const res = await pool.query(`SELECT value FROM app_settings WHERE key = 'bot_cloaking'`);
    if (res.rows.length) return { ...DEFAULT_CONFIG, ...(res.rows[0].value as Partial<BotConfig>) };
  } catch {}
  return DEFAULT_CONFIG;
}

async function getCampaignBotVariant(slug: string): Promise<Variant | null> {
  try {
    const res = await pool.query(`SELECT bot_variant FROM pixels WHERE slug = $1`, [slug]);
    const v = res.rows[0]?.bot_variant;
    return v === 'a' || v === 'b' ? v : null;
  } catch {}
  return null;
}

export default async function BotPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;

  // Per-campaign override: if this link has ?c= and the campaign has bot_variant set, use it
  if (c) {
    const campaignVariant = await getCampaignBotVariant(c);
    if (campaignVariant) {
      return <AuthPage variant={campaignVariant} />;
    }
  }

  const config = await getBotConfig();

  // Cloaking disabled → show normal page (content browser)
  if (!config.enabled) return <LandingPage />;

  // External redirect
  if (config.mode === 'redirect') {
    if (config.redirect_url) redirect(config.redirect_url);
    return <LandingPage />;
  }

  // Landing Variant A (original signup page)
  if (config.mode === 'landing_a') {
    return <AuthPage variant="a" />;
  }

  // Landing Variant B (benefits signup page)
  if (config.mode === 'landing_b') {
    return <AuthPage variant="b" />;
  }

  // Custom HTML mode
  if (config.html_content) {
    return (
      <html>
        <head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
        <body dangerouslySetInnerHTML={{ __html: config.html_content }} />
      </html>
    );
  }

  return <LandingPage />;
}
