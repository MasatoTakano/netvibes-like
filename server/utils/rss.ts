// server/utils/rss.ts
// RSS フィードの取得・パース・正規化・エラー分類を担うサービス層。
// トランスポート層 (server/api/rss.get.ts) から分離し、ハンドラを薄く保つ。

import { createError } from 'h3';
import Parser from 'rss-parser';
import { fetchUrlSafely } from '~/server/utils/ssrf';
import type { FeedData } from '~/types';

const FETCH_TIMEOUT_MS = 10000;
const FETCH_MAX_REDIRECTS = 5;
const FETCH_MAX_BYTES = 1024 * 1024; // 1 MiB

// rss-parser インスタンス（タイムアウト付き）
const parser = new Parser({ timeout: FETCH_TIMEOUT_MS });

// クライアントに返すアイテム数の上限
const MAX_ITEMS = 50;

/**
 * RSS フィード URL を安全に取得し、パースしてクライアント向けに正規化して返す。
 * 取得・パース・検証の各エラーは適切な HTTP ステータスに分類して createError で送出する。
 * 内部情報（URL やレスポンス本文）はクライアントにもサーバーログにも出さない。
 */
export async function fetchRssFeed(feedUrl: string): Promise<FeedData> {
  try {
    const feedXml = await fetchUrlSafely(feedUrl, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: FETCH_MAX_REDIRECTS,
      maxBytes: FETCH_MAX_BYTES,
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
    throw classifyFeedError(error);
  }
}

/**
 * 受け取った値が http/https URL の場合のみ文字列として返し、それ以外は undefined にする。
 * 外部フィード由来のプロパティ (javascript: 等) がクライアントに渡るのを防ぐ。
 */
function toSafeHttpUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * 取得・パース時のエラーを汎用的な HTTP エラーに分類する。
 * 内部情報を秘匿しつつ、クライアントが処理できるステータスコードを割り当てる。
 */
function classifyFeedError(error: any): Error {
  // 詳細（URL や本文）はログに出さない
  console.error('[RSS] Failed to fetch or parse RSS feed.');

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

  return createError({ statusCode, statusMessage });
}
