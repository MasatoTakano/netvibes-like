// server/utils/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '~/server/utils/prisma';
import { hash, verify } from '@node-rs/argon2';
import { createError, type H3Event } from 'h3';
import { sendEmail } from '~/server/utils/email';
import {
  emailVerificationTemplate,
  passwordResetTemplate,
} from '~/server/utils/emailTemplates';

const ARGON2_PARAMS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // 既存のArgon2idハッシュとの互換性を維持
    password: {
      hash: async (password: string) => {
        return hash(password, ARGON2_PARAMS);
      },
      verify: async ({ hash: storedHash, password }) => {
        return verify(storedHash, password);
      },
    },
    // パスワードリセットメール送信
    sendResetPassword: async ({ user, url }) => {
      const { subject, html, text } = passwordResetTemplate(url);
      await sendEmail({
        to: user.email,
        subject,
        html,
        text,
      });
    },
  },
  emailVerification: {
    // サインアップ時に自動で確認メールを送信
    sendOnSignUp: true,
    // 確認メール送信処理
    sendVerificationEmail: async ({ user, url }) => {
      const { subject, html, text } = emailVerificationTemplate(url);
      await sendEmail({
        to: user.email,
        subject,
        html,
        text,
      });
    },
  },
  user: {
    additionalFields: {
      // Layout, Setting は別テーブルなので追加フィールド不要
    },
    // アカウント削除を有効化（パスワード確認必須）
    deleteUser: {
      enabled: true,
      // 送信前にセッションを無効化しない（afterDeleteで自動処理される）
      // sendDeleteAccountVerification を設定しない = パスワード確認のみで即時削除
    },
  },
  session: {
    // セッション有効期間: 7日間
    expiresIn: 60 * 60 * 24 * 7,
    // セッション更新間隔: 1日経過で延長
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    window: 15 * 60, // 15分（秒）
    max: 30, // 全認証エンドポイント合計で30回/15分
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

// --- 型推論のための推論ヘルパー ---
export type Session = typeof auth.$Infer.Session;

/**
 * リクエストからセッションを検証し、認証済みの session + user を返す。
 * 未認証の場合は 401 エラーを投げる。
 * 各 API エンドポイントの認証ボイラープレートを共通化するヘルパー。
 */
export async function requireSession(event: H3Event) {
  const session = await auth.api.getSession({
    headers: event.node.req.headers as any,
  });

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  return session; // { session, user }
}
