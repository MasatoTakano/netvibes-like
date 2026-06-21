// server/utils/ssrf.ts
import * as http from 'node:http';
import * as https from 'node:https';
import { promises as dns } from 'node:dns';
import * as net from 'node:net';
import { createRequire } from 'node:module';

const require = createRequire(`${process.cwd()}/package.json`);
const ipaddr: any = require('ipaddr.js');

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 MiB

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

/**
 * URL が http/https かつ外部公開アドレスだけを指しているか検証する。
 * DNS リバインディング対策として、検証済みIPを返し、実際の fetch 時に custom lookup で固定する。
 */
export async function resolveSafeAddressForUrl(
  parsed: URL,
): Promise<ResolvedAddress> {
  validateUrlSyntax(parsed);

  const addresses = await resolveAll(parsed.hostname);
  const publicAddresses = addresses.filter(({ address }) => isGlobalAddress(address));

  if (publicAddresses.length === 0) {
    throw new SafeFetchError('Blocked non-public address', 400);
  }

  return publicAddresses[0];
}

/**
 * SSRF 対策付きで URL を取得する。
 * - リダイレクトは手動追跡し、各 Location を再検証する
 * - DNS 解決した安全IPを request lookup に固定し、検証後の再解決を防ぐ
 * - レスポンスサイズとタイムアウトを制限する
 */
export async function fetchUrlSafely(
  inputUrl: string,
  options: {
    timeoutMs?: number;
    maxRedirects?: number;
    maxBytes?: number;
  } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let currentUrl = inputUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    let parsed: URL;
    try {
      parsed = new URL(currentUrl);
    } catch {
      throw new SafeFetchError('Invalid URL', 400);
    }

    const safeAddress = await resolveSafeAddressForUrl(parsed);
    const response = await requestWithPinnedAddress(parsed, safeAddress, {
      timeoutMs,
      maxBytes,
    });

    if (response.statusCode >= 300 && response.statusCode < 400) {
      const location = response.headers.location;
      if (!location) {
        throw new SafeFetchError('Redirect without Location header', 400);
      }
      if (redirectCount === maxRedirects) {
        throw new SafeFetchError('Too many redirects', 400);
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`Status code ${response.statusCode}`);
    }

    return response.body;
  }

  throw new SafeFetchError('Too many redirects', 400);
}

/**
 * 後方互換用: URL が安全なら true を返す。
 * 実際の外部取得では fetchUrlSafely を使うこと。
 */
export async function isUrlSafeForFetch(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    await resolveSafeAddressForUrl(parsed);
    return true;
  } catch {
    return false;
  }
}

/**
 * 後方互換用: ホスト名が非公開/内部アドレスなら true。
 */
export async function isPrivateAddress(hostname: string): Promise<boolean> {
  try {
    const addresses = await resolveAll(hostname);
    return addresses.length === 0 || addresses.some(({ address }) => !isGlobalAddress(address));
  } catch {
    return true;
  }
}

function validateUrlSyntax(parsed: URL): void {
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SafeFetchError('Invalid URL protocol', 400);
  }

  if (parsed.username || parsed.password) {
    throw new SafeFetchError('URL credentials are not allowed', 400);
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new SafeFetchError('Non-standard ports are not allowed', 400);
  }
}

async function resolveAll(hostname: string): Promise<ResolvedAddress[]> {
  const normalizedHostname = hostname.replace(/^\[(.*)\]$/, '$1');

  if (net.isIP(normalizedHostname)) {
    return [
      {
        address: normalizedHostname,
        family: net.isIP(normalizedHostname) as 4 | 6,
      },
    ];
  }

  const records = await dns.lookup(normalizedHostname, { all: true });
  return records.map((record) => ({
    address: record.address,
    family: record.family as 4 | 6,
  }));
}

function isGlobalAddress(ip: string): boolean {
  const parsed = ipaddr.parse(ip);

  if (parsed.kind() === 'ipv6') {
    const ipv6 = parsed as any;
    if (ipv6.isIPv4MappedAddress()) {
      return isGlobalAddress(ipv6.toIPv4Address().toString());
    }
  }

  // ipaddr.js の range() が unicast のものだけを許可する deny-by-default 方針。
  // private, loopback, linkLocal, multicast, reserved, carrierGradeNat, unspecified 等は拒否。
  return parsed.range() === 'unicast';
}

function requestWithPinnedAddress(
  parsed: URL,
  safeAddress: ResolvedAddress,
  options: { timeoutMs: number; maxBytes: number },
): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        servername: parsed.hostname,
        timeout: options.timeoutMs,
        headers: {
          'User-Agent': 'memo-app-rss-fetcher/1.0',
          Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
        lookup: (_hostname, lookupOptions, callback) => {
          if (typeof lookupOptions === 'object' && (lookupOptions as any).all) {
            callback(null, [
              { address: safeAddress.address, family: safeAddress.family },
            ] as any);
            return;
          }
          callback(null, safeAddress.address, safeAddress.family);
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let totalBytes = 0;

        response.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > options.maxBytes) {
            request.destroy(new SafeFetchError('Response too large', 413));
            return;
          }
          chunks.push(chunk);
        });

        response.on('end', () => {
          resolve({
            statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(new SafeFetchError('Request timeout', 400));
    });

    request.on('error', reject);
    request.end();
  });
}
