// server/utils/clientIp.ts
// リバースプロキシ(Traefik)背後で、なりすまし耐性のあるクライアントIPを取り出す。

/**
 * X-Forwarded-For ヘッダとソケットのリモートアドレスからクライアントIPを決定する。
 *
 * 【重要】X-Forwarded-For の **先頭** エントリは末端クライアントが自由に偽装できるため
 * 信頼しない。単一プロキシ(Traefik)が追記した **最末尾** エントリを採用する。
 * 多段プロキシ構成にする場合は、信頼できるホップ数ぶん右から戻るよう修正すること。
 */
export function pickTrustedClientIp(options: {
  xForwardedFor?: string | null;
  socketRemoteAddress?: string | null;
}): string {
  const { xForwardedFor, socketRemoteAddress } = options;

  if (xForwardedFor) {
    const parts = xForwardedFor
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) {
      // クライアント偽装可能な先頭(parts[0])ではなく、プロキシ追記の末尾を採用
      return parts[parts.length - 1];
    }
  }

  return socketRemoteAddress || 'unknown';
}
