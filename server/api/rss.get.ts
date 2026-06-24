// server/api/rss.get.ts
import { defineEventHandler, getQuery, createError, getHeader, setResponseHeader } from 'h3';
import { requireSession } from '~/server/utils/auth';
import { fetchRssFeed } from '~/server/utils/rss';
import { checkRateLimit } from '~/server/utils/rateLimit';
import { getCachedFeed, setCachedFeed } from '~/server/utils/feedCache';
import { pickTrustedClientIp } from '~/server/utils/clientIp';

// レートリミット設定: ユーザー/IPあたり 5分間に30リクエスト
const RATE_LIMIT_CONFIG = {
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
};

export default defineEventHandler(async (event) => {
  // --- 1. 認証チェック ---
  const { user } = await requireSession(event);

  // --- 2. レートリミット ---
  const clientIp = pickTrustedClientIp({
    xForwardedFor: getHeader(event, 'x-forwarded-for'),
    socketRemoteAddress: event.node.req.socket.remoteAddress,
  });
  // ユーザーIDを優先し、未認証の場合はIPでフォールバック（認証済みなので通常はユーザーID）
  const rateLimitKey = `rss:${user.id}:${clientIp}`;
  const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIG);

  if (!rateLimitResult.allowed) {
    setResponseHeader(event, 'Retry-After', Math.ceil(rateLimitResult.resetMs / 1000));
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests: RSS feed rate limit exceeded. Please try again later.',
    });
  }

  // --- 3. クエリパラメータ取得 ---
  const query = getQuery(event);
  const feedUrl = query.url as string | undefined;

  if (!feedUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Query parameter "url" is required.',
    });
  }

  // --- 4. キャッシュ確認 ---
  const cached = getCachedFeed(feedUrl);
  if (cached) {
    return cached;
  }

  // --- 5. フィード取得・パース・正規化（サービス層に委譲） ---
  const feedData = await fetchRssFeed(feedUrl);

  // 成功したフィードのみキャッシュに保存（エラーはキャッシュしない）
  setCachedFeed(feedUrl, feedData);

  return feedData;
});
