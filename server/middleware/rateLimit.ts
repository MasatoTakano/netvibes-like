// server/middleware/rateLimit.ts
// ログイン試行のレートリミント（IP単位、メモリベース）
// 単一インスタンス運用を前提。多段構成の場合は Redis 等の外部ストアに移行すること。

import {
  defineEventHandler,
  createError,
  getRequestHeader,
  setResponseHeader,
  type H3Event,
} from 'h3';

const WINDOW_MS = 15 * 60 * 1000; // 15分ウィンドウ
const MAX_ATTEMPTS = 10; // 15分あたり10回まで

interface RateEntry {
  count: number;
  resetAt: number;
}

const attempts = new Map<string, RateEntry>();

// 期限切れエントリの定期クリーンアップ（メモリリーク防止）
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const expiredKeys: string[] = [];
  attempts.forEach((entry, key) => {
    if (now > entry.resetAt) {
      expiredKeys.push(key);
    }
  });
  expiredKeys.forEach((key) => attempts.delete(key));
}

export default defineEventHandler(async (event: H3Event) => {
  // /api/login POST のみに適用
  const url = event.path || event.node.req.url || '';
  if (!url.startsWith('/api/login') || event.method !== 'POST') {
    return;
  }

  cleanup();

  // クライアント IP を取得（Traefik 背後を想定）
  const xForwardedFor = getRequestHeader(event, 'x-forwarded-for');
  const ip =
    (xForwardedFor && xForwardedFor.split(',')[0]?.trim()) ||
    event.node.req.socket.remoteAddress ||
    'unknown';

  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count++;

  if (entry.count > MAX_ATTEMPTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    setResponseHeader(event, 'Retry-After', retryAfter);
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Please try again later.',
    });
  }
});
