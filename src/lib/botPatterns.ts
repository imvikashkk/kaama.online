// Bot User-Agent patterns for cloaking.
// Lowercase substring match against incoming UA header.
// Add new bot signatures here — one per line.
export const BOT_PATTERNS: string[] = [
  // Major search engines
  'googlebot',
  'bingbot',
  'slurp',          // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'applebot',
  'petalbot',

  // ── Meta / Facebook (all known crawlers) ──────────────────
  // Link-preview crawler (Facebook, Instagram, Messenger shares)
  'facebookexternalhit',
  'facebot',
  // Product catalog fetcher
  'facebookcatalog',
  // Public web crawler for AI / speech recognition
  'facebookbot',
  // Meta AI foundation model training crawler
  'meta-externalagent',
  // Fetches links on user request (agentic Meta AI features)
  'meta-externalfetcher',
  // Meta AI search indexer
  'meta-webindexer',
  // Meta ads analytics crawler
  'meta-externalads',
  // ──────────────────────────────────────────────────────────

  // Other social media crawlers
  'twitterbot',
  'linkedinbot',
  'slackbot',
  'discordbot',
  'telegrambot',
  'whatsapp/',

  // SEO tools
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'dotbot',
  'screaming frog',
  'rogerbot',
  'seznambot',

  // Generic scrapers / automation
  'scrapy',
  'python-requests',
  'python-urllib',
  'go-http-client',
  'curl/',
  'wget/',
  'libwww-perl',
  'jakarta commons',
  'axios/',

  // Headless / browser automation
  'headlesschrome',
  'phantomjs',
  'selenium',
  'webdriver',
  'puppeteer',
];
