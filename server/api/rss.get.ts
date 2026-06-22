// server/api/rss.get.ts
import { defineEventHandler, getQuery, createError } from 'h3';
import { requireSession } from '~/server/utils/auth';
import { fetchRssFeed } from '~/server/utils/rss';

export default defineEventHandler(async (event) => {
  // --- 1. 認証チェック ---
  await requireSession(event);

  // --- 2. クエリパラメータ取得 ---
  const query = getQuery(event);
  const feedUrl = query.url as string | undefined;

  if (!feedUrl) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Query parameter "url" is required.',
    });
  }

  // --- 3. フィード取得・パース・正規化（サービス層に委譲） ---
  return await fetchRssFeed(feedUrl);
});
