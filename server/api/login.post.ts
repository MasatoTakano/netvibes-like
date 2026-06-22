// server/api/login.post.ts
import { z } from 'zod';
import { lucia } from '~/server/utils/auth'; // Lucia インスタンス
import { prisma } from '~/server/utils/prisma';
import { verifyPassword, getDummyHash } from '~/server/utils/password';

const loginSchema = z.object({
  email: z.string().min(1).transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // --- 入力値バリデーション (Zod) ---
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid credentials format',
    });
  }
  const { email, password } = parsed.data;

  try {
    // --- Key 情報の検索 ---
    // Lucia は Key テーブルを使って認証情報を管理します。
    // ID/PW認証の場合、キーIDは `email:your@email.com` 形式です。
    const key = await prisma.key.findUnique({
      where: {
        id: `email:${email}`, // email をキーIDとして検索
      },
    });

    if (!key || !key.hashedPassword) {
      // ユーザーが存在しないか、パスワードが設定されていない場合。
      // タイミング攻撃(メール列挙)対策: 存在しないアカウントでも argon2 verify の
      // 計算コストを払って応答時間を均す。結果は破棄する。
      await verifyPassword(await getDummyHash(), password).catch(() => false);
      throw createError({
        statusCode: 401, // Unauthorized
        statusMessage: 'Incorrect email or password', // 具体的な理由は返さない
      });
    }

    // --- パスワードの検証 ---
    const isValidPassword = await verifyPassword(key.hashedPassword, password);

    if (!isValidPassword) {
      throw createError({
        statusCode: 401, // Unauthorized
        statusMessage: 'Incorrect email or password',
      });
    }

    // --- セッションの作成 ---
    // 認証成功！新しいセッションを作成します。
    const session = await lucia.createSession(key.userId, {
      // セッションに含めたい追加データがあればここに記述 (例: IPアドレス、User-Agent)
      // ip_address: getRequestIP(event),
      // user_agent: getRequestHeader(event, 'user-agent'),
    });

    // --- セッション Cookie の作成と設定 ---
    const sessionCookie = lucia.createSessionCookie(session.id);
    setCookie(
      event,
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    const validatedUser = await prisma.user.findUnique({
      where: { id: key.userId },
      select: { id: true, email: true, name: true }, // 必要な情報だけ取得
    });

    if (!validatedUser) {
      // 通常は key があれば user も存在するはずだが念のため
      throw createError({
        statusCode: 500,
        statusMessage: 'Could not retrieve user data after login',
      });
    }
    // ログイン成功レスポンス (特にデータは返さなくても良い)
    return {
      success: true,
      user: {
        userId: validatedUser.id,
        email: validatedUser.email,
        name: validatedUser.name,
      },
    };
  } catch (error: any) {
    if (error.statusCode) {
      // createError で投げられたエラーはそのまま返す
      throw error;
    }
    // その他の予期せぬエラー
    throw createError({
      statusCode: 500,
      statusMessage: 'An internal server error occurred',
    });
  }
});
