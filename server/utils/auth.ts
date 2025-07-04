// server/utils/auth.ts
import { Lucia } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { PrismaClient } from '@prisma/client';
// import { webcrypto } from 'node:crypto'; // Node.js v18+ の場合 (古い場合は 'crypto' を試す)

// Node.js の crypto をグローバルに利用可能にする (Lucia/oslo が必要とする場合がある)
// globalThis.crypto = webcrypto as Crypto;

// Prisma Client のインスタンス (シングルトン推奨)
const client = new PrismaClient();

// Lucia と Prisma を連携させるアダプター
const adapter = new PrismaAdapter(client.session, client.user);

// Lucia のインスタンスを作成
export const lucia = new Lucia(adapter, {
  // セッション Cookie の設定
  sessionCookie: {
    name: 'session', // Cookie 名
    expires: false, // false = セッション Cookie (ブラウザ閉じたら消える)
    attributes: {
      secure: process.env.NUXT_LUCIA_COOKIE_SECURE === 'true', // 環境変数で制御
      path: '/',
      sameSite: 'lax', // CSRF対策に推奨
    },
  },
  // セッションから取得するユーザー情報の属性
  getUserAttributes: (attributes) => {
    console.log('[Lucia getUserAttributes] Received attributes:', attributes); // ← 追加
    const result = {
      // userId: attributes.id,
      email: attributes.email,
      name: attributes.name,
    };
    console.log('[Lucia getUserAttributes] Returning user object:', result); // ← 追加
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
