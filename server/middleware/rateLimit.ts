// server/middleware/rateLimit.ts
// 認証系エンドポイントのレートリミット（IP単位、メモリベース）。
// 単一インスタンス運用を前提。多段構成の場合は Redis 等の外部ストアに移行すること。

import {
  defineEventHandler,
  createError,
  getRequestHeader,
  setResponseHeader,
  type H3Event,
} from 'h3';
import { pickTrustedClientIp } from '~/server/utils/clientIp';

const WINDOW_MS = 15 * 60 * 1000; // 15分ウィンドウ

// 保護対象ルートとウィンドウあたりの上限。
// - login: クレデンシャルスタッフィング対策
// - signup: メール列挙(409応答)と大量アカウント生成対策
interface ProtectedRoute {
  key: string;
  max: number;
  matches: (url: string, method: string) => boolean;
}

const PROTECTED_ROUTES: ProtectedRoute[] = [
  {
    key: 'login',
    max: 10,
    matches: (url, method) => url === '/api/login' && method === 'POST',
  },
  {
    key: 'signup',
    max: 5,
    matches: (url, method) => url === '/api/signup' && method === 'POST',
  },
];

interface RateEntry {
  count: number;
  resetAt: number;
}

// バケットキーは `${routeKey}:${ip}` でルート毎に独立カウントする
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
  const url = event.path || event.node.req.url || '';
  const method = event.method;

  const route = PROTECTED_ROUTES.find((r) => r.matches(url, method));
  if (!route) {
    return;
  }

  cleanup();

  // クライアント IP を取得（XFF 偽装対策済みのヘルパーを使用）
  const ip = pickTrustedClientIp({
    xForwardedFor: getRequestHeader(event, 'x-forwarded-for'),
    socketRemoteAddress: event.node.req.socket.remoteAddress,
  });

  const bucketKey = `${route.key}:${ip}`;
  const now = Date.now();
  const entry = attempts.get(bucketKey);

  if (!entry || now > entry.resetAt) {
    attempts.set(bucketKey, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count++;

  if (entry.count > route.max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    setResponseHeader(event, 'Retry-After', retryAfter);
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many requests. Please try again later.',
    });
  }
});
