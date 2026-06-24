// server/middleware/originCheck.ts
// 状態変更 API (POST/PUT/PATCH/DELETE) の CSRF 対策。
// Origin (または Referer fallback) がアプリ自身のオリジンと一致するか検証する。
//
// Better Auth の /api/auth/* ルートは Better Auth 側で Origin チェックが行われるため除外。
// 独自の状態変更 API (/api/layout, /api/settings 等) を保護する。

import { defineEventHandler, getRequestHeader, createError } from 'h3';

/** 状態変更を伴う HTTP メソッド */
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Better Auth が独自に Origin チェックを行うルート */
const AUTH_PREFIX = '/api/auth/';

/**
 * アプリ自身の許可オリジンを取得する。
 * BETTER_AUTH_URL から origin (protocol + host) を抽出する。
 */
function getAllowedOrigin(): string {
  const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';
  try {
    const url = new URL(baseURL);
    return url.origin;
  } catch {
    return baseURL;
  }
}

/**
 * リクエストの Origin または Referer から origin 部分を抽出する。
 * ブラウザは同一サイトリクエストでも Origin ヘッダーを送信する (POST の場合必須)。
 * Origin がない場合は Referer からフォールバックする。
 */
function getRequestOrigin(
  originHeader: string | undefined,
  refererHeader: string | undefined,
): string | null {
  if (originHeader) {
    try {
      return new URL(originHeader).origin;
    } catch {
      return null;
    }
  }

  // Origin がない場合は Referer からフォールバック
  if (refererHeader) {
    try {
      return new URL(refererHeader).origin;
    } catch {
      return null;
    }
  }

  return null;
}

export default defineEventHandler((event) => {
  const method = event.node.req.method?.toUpperCase() ?? '';
  const path = event.node.req.url ?? '';

  // GET/HEAD/OPTIONS は状態変更しないため対象外
  if (!STATE_CHANGING_METHODS.has(method)) return;

  // Better Auth ルートは除外 (Better Auth 側で Origin チェック済み)
  if (path.startsWith(AUTH_PREFIX)) return;

  const allowedOrigin = getAllowedOrigin();
  const originHeader = getRequestHeader(event, 'origin');
  const refererHeader = getRequestHeader(event, 'referer');
  const requestOrigin = getRequestOrigin(originHeader, refererHeader);

  if (!requestOrigin || requestOrigin !== allowedOrigin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden: Invalid origin',
    });
  }

  // POST/PUT/PATCH の Content-Type は application/json を要求
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    const contentType = getRequestHeader(event, 'content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw createError({
        statusCode: 415,
        statusMessage: 'Unsupported Media Type: Content-Type must be application/json',
      });
    }
  }
});
