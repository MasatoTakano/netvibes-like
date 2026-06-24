// server/utils/rateLimit.ts
// インメモリ・スライディングウィンドウ方式の簡易レートリミッター。
// プロセス単位で動作する（クラスタ再起動でリセット）。小規模運用向け。

/**
 * レートリミットの設定。
 */
export interface RateLimitConfig {
  /** ウィンドウ幅 (ミリ秒) */
  windowMs: number;
  /** ウィンドウ内の最大リクエスト数 */
  maxRequests: number;
}

interface BucketEntry {
  timestamps: number[];
  lastAccessAt: number;
}

// key → { timestamps[] }
// Map はリークしないよう、エントリが maxRequests を超えた時点で
// ウィンドウ外のタイムスタンプを破棄する。
// また、定期的なスイープ（sweep）で長期間アクセスのないエントリを削除する。
const buckets = new Map<string, BucketEntry>();

// --- 定期スイープ: 長期間アクセスのないエントリを削除 ---
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 分ごとに実行
const SWEEP_MAX_IDLE_MS = 15 * 60 * 1000; // 15 分以上アクセスがないエントリを削除

if (process.env.NODE_ENV !== 'test') {
  const timer = setInterval(() => {
    const now = Date.now();
    buckets.forEach((entry, key) => {
      if (now - entry.lastAccessAt > SWEEP_MAX_IDLE_MS) {
        buckets.delete(key);
      }
    });
  }, SWEEP_INTERVAL_MS);
  timer.unref(); // プロセス終了をブロックしない
}

/**
 * 指定キーに対してレートリミットをチェックする。
 * リクエストが許可される場合は true、拒否される場合は false を返す。
 * 拒否された場合はリクエストをカウントしない（失敗で枠を消費させない）。
 *
 * @returns { allowed: boolean; remaining: number; resetMs: number }
 *          remaining = ウィンドウ内の残りリクエスト数
 *          resetMs = 最も古いタイムスタンプが期限切れまでのミリ秒
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = buckets.get(key);

  if (!entry) {
    entry = { timestamps: [], lastAccessAt: now };
    buckets.set(key, entry);
  }

  // ウィンドウ外のタイムスタンプを破棄
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetMs: oldest + config.windowMs - now,
    };
  }

  entry.timestamps.push(now);
  entry.lastAccessAt = now;

  return {
    allowed: true,
    remaining: config.maxRequests - entry.timestamps.length,
    resetMs: config.windowMs,
  };
}

/**
 * テスト用: 全バケットをクリアする。
 */
export function _resetRateLimitBuckets(): void {
  buckets.clear();
}
