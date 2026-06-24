// server/utils/feedCache.ts
// RSS フィードの短期インメモリTTLキャッシュ。
// 同一フィードURLへの短時間の再取得を回避し、外部サーバーへの負荷とレスポンス時間を削減する。

import type { FeedData } from '~/types';

interface CacheEntry {
  data: FeedData;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 分
const MAX_ENTRIES = 100; // 最大キャッシュエントリ数

const cache = new Map<string, CacheEntry>();

/**
 * フィードURLに対応するキャッシュデータを取得する。
 * 期限切れまたは未キャッシュの場合は null を返す。
 */
export function getCachedFeed(feedUrl: string): FeedData | null {
  const entry = cache.get(feedUrl);
  if (!entry) return null;

  if (Date.now() >= entry.expiresAt) {
    cache.delete(feedUrl);
    return null;
  }

  return entry.data;
}

/**
 * フィードデータをキャッシュに保存する。
 * エントリ数が上限に達した場合は、最古のエントリを削除してから追加する。
 */
export function setCachedFeed(
  feedUrl: string,
  data: FeedData,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  // キャッシュサイズが上限に達した場合、期限切れエントリを優先的に削除
  if (cache.size >= MAX_ENTRIES) {
    evictExpired();
    // それでも上限の場合は最古の期限切れエントリを削除
    if (cache.size >= MAX_ENTRIES) {
      let oldestKey: string | null = null;
      let oldestExpiry = Infinity;
      cache.forEach((entry, key) => {
        if (entry.expiresAt < oldestExpiry) {
          oldestExpiry = entry.expiresAt;
          oldestKey = key;
        }
      });
      if (oldestKey) cache.delete(oldestKey);
    }
  }

  cache.set(feedUrl, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * 期限切れエントリを一括削除する。
 */
function evictExpired(): void {
  const now = Date.now();
  const expiredKeys: string[] = [];
  cache.forEach((entry, key) => {
    if (now >= entry.expiresAt) {
      expiredKeys.push(key);
    }
  });
  expiredKeys.forEach((key) => cache.delete(key));
}

/**
 * テスト用: キャッシュを全クリアする。
 */
export function _resetFeedCache(): void {
  cache.clear();
}
