// server/api/rss.get.ts
import { defineEventHandler, getQuery, createError } from 'h3';
import Parser from 'rss-parser';
import { requireSession } from '~/server/utils/auth';
import { fetchUrlSafely } from '~/server/utils/ssrf';

// タイムアウト設定付き rss-parser インスタンス
const parser = new Parser({
  timeout: 10000, // 10秒
});

// クライアントに返すアイテム数の上限
const MAX_ITEMS = 50;

const toSafeHttpUrl = (value?: string): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
};

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

  // --- 3. フィード取得・パース ---
  try {
    const feedXml = await fetchUrlSafely(feedUrl, {
      timeoutMs: 10000,
      maxRedirects: 5,
      maxBytes: 1024 * 1024,
    });
    const feed = await parser.parseString(feedXml);

    // アイテム数を制限し、外部フィード由来の URL は http/https のみに正規化して返す
    const items = (feed.items || []).slice(0, MAX_ITEMS).map((item) => ({
      title: item.title,
      link: toSafeHttpUrl(item.link),
      pubDate: item.pubDate,
      isoDate: item.isoDate,
      contentSnippet: item.contentSnippet,
      guid: item.guid,
    }));

    return {
      title: feed.title,
      link: toSafeHttpUrl(feed.link),
      items,
    };
  } catch (error: any) {
    // 詳細はクライアントに返さず、サーバーログにもURLや本文を出さない
    console.error('[API GET /api/rss] Failed to fetch or parse RSS feed.');

    // エラーの種類に応じてステータスコードを調整
    let statusCode = 500;
    let statusMessage = 'Failed to fetch or parse RSS feed.';

    if (typeof error.statusCode === 'number') {
      statusCode = error.statusCode;
      statusMessage =
        statusCode === 413
          ? 'RSS feed response is too large.'
          : 'Invalid or blocked feed URL.';
    } else if (error.message?.includes('Status code')) {
      const match = error.message.match(/Status code (\d+)/);
      if (match && match[1]) {
        const httpStatus = parseInt(match[1], 10);
        if (httpStatus >= 400 && httpStatus < 500) {
          statusCode = httpStatus;
          statusMessage = `Failed to fetch feed: ${httpStatus}`;
        }
      }
    } else if (
      error.message?.includes('Blocked') ||
      error.message?.includes('Invalid URL') ||
      error.message?.includes('Invalid URL protocol') ||
      error.message?.includes('URL credentials') ||
      error.message?.includes('Non-standard ports') ||
      error.message?.includes('Too many redirects') ||
      error.message?.includes('Redirect without Location') ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.message?.includes('timeout')
    ) {
      statusCode = 400;
      statusMessage = 'Invalid or unreachable feed URL.';
    }

    // クライアントには汎用メッセージのみ返す（内部情報は詳細ログに留める）
    throw createError({
      statusCode,
      statusMessage,
    });
  }
});
