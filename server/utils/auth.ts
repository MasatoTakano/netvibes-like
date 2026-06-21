// server/utils/auth.ts
import { Lucia, type Session } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { prisma as client } from '~/server/utils/prisma';
import { getCookie, setCookie, createError, type H3Event } from 'h3';

// Lucia と Prisma を連携させるアダプター
const adapter = new PrismaAdapter(client.session, client.user);

// Lucia のインスタンスを作成
export const lucia = new Lucia(adapter, {
  // セッション Cookie の設定
  sessionCookie: {
    name: 'session', // Cookie 名
    expires: false, // false = セッション Cookie (ブラウザ閉じたら消える)
    attributes: {
      secure:
        process.env.NUXT_LUCIA_COOKIE_SECURE !== 'false' &&
        (process.env.NODE_ENV === 'production' ||
          process.env.NUXT_LUCIA_COOKIE_SECURE === 'true'), // 本番は secure を既定で有効化
      path: '/',
      sameSite: 'lax', // CSRF対策に推奨
    },
  },
  // セッションから取得するユーザー情報の属性
  getUserAttributes: (attributes) => {
    const result = {
      email: attributes.email,
      name: attributes.name,
    };
    return result;
  },
});

// Lucia の型定義を拡張 (TypeScript用)
// これにより、session.user や getUserAttributes の型が正しく推論される
declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
    SessionUser: {
      userId: string; // session.user にも userId を含める場合 (冗長かもしれない)
      email: string;
      name: string | null;
    };
  }
}

// DB の User モデルから Lucia が取得する属性の型を定義
interface DatabaseUserAttributes {
  // id: string; // DBの id は string 型のはず
  email: string;
  name: string | null;
}

/**
 * リクエストのセッションを検証し、認証済みの userId と session を返す。
 * 未認証の場合は 401 エラーを投げる。
 * 各 API エンドポイントの認証ボイラープレートを共通化するヘルパー。
 */
export async function requireSession(
  event: H3Event,
): Promise<{ userId: string; session: Session }> {
  const sessionId = getCookie(event, lucia.sessionCookieName);
  if (!sessionId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: No session',
    });
  }

  const { session } = await lucia.validateSession(sessionId);

  if (!session) {
    // 無効なセッション Cookie をクライアントから削除
    const sessionCookie = lucia.createBlankSessionCookie();
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Invalid session',
    });
  }

  // セッションの鮮度を更新
  if (session.fresh) {
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
  }

  return { userId: session.userId, session };
}
