// server/api/signup.post.ts
import { generateId } from 'lucia'; // ユーザーID生成用
import { z } from 'zod';
import { prisma } from '~/server/utils/prisma';
import {
  defaultLayoutData,
  DEFAULT_GLOBAL_SETTINGS,
} from '~/constants';
import { hashPassword } from '~/server/utils/password';

// --- 入力バリデーションスキーマ ---
const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .max(254, 'Email is too long')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format')
    .transform((e) => e.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password is too long'),
  name: z.string().max(100, 'Name is too long').optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // --- 入力値バリデーション (Zod) ---
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parsed.error.issues[0]?.message || 'Invalid input',
    });
  }
  const { email, password, name } = parsed.data;
  const optionalName = name ?? null;

  try {
    // --- Email の重複チェック ---
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    });
    if (existingUser) {
      throw createError({
        statusCode: 409, // Conflict
        statusMessage: 'Email already in use',
      });
    }

    // --- パスワードのハッシュ化 ---
    // Argon2id を使用 (server/utils/password.ts でパラメータを一元管理)
    const hashedPassword = await hashPassword(password);

    // --- ユーザーIDの生成 ---
    const userId = generateId(15); // 15文字のランダムなID

    // --- データベースへの保存 ---
    // User と Key を同時に作成 (トランザクション内で実行される)
    await prisma.user.create({
      data: {
        id: userId,
        email: email,
        name: optionalName,
        // デフォルトの Layout と Setting もここで作成できる
        layout: {
          create: {
            data: JSON.stringify(defaultLayoutData), // デフォルトレイアウト
          },
        },
        setting: {
          create: {
            data: JSON.stringify(DEFAULT_GLOBAL_SETTINGS), // デフォルト設定
          },
        },
        // Key情報も作成
        keys: {
          create: {
            id: `email:${email}`, // キーのID (プロバイダー:識別子)
            hashedPassword: hashedPassword,
          },
        },
      },
    });

    // --- (任意) サインアップ後に自動ログインさせる場合 ---
    // const session = await lucia.createSession(userId, {});
    // const sessionCookie = lucia.createSessionCookie(session.id);
    // setCookie(event, sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    // return { success: true, user: { id: userId, email } }; // セッション情報などを返す
    // サインアップ成功レスポンス (自動ログインさせない場合)
    return { success: true };
  } catch (error: any) {

    // エラーが createError で作成されたものならそのまま投げる
    if (error.statusCode) {
      throw error;
    }

    // メール一意制約違反(並発リクエストによるTOCTOU)は 409 に変換。
    // DB の @unique 制約が最終防御線となる。
    if (error.code === 'P2002') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Email already in use',
      });
    }

    // その他の予期せぬエラー
    throw createError({
      statusCode: 500,
      statusMessage: 'An internal server error occurred',
    });
  }
});
