// server/api/signup.post.ts
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2'; // oslo/password の代わりに Argon2 を直接使う (oslo非推奨化のため)
import { generateId } from 'lucia'; // ユーザーID生成用

const prisma = new PrismaClient();

// Email の形式を簡易的にチェックする関数 (必要に応じてより厳密に)
const isValidEmail = (email: string): boolean => {
  // 簡単な正規表現チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { email, password, name } = body;

  // --- 入力値バリデーション ---
  if (typeof email !== 'string' || !isValidEmail(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format',
    });
  }
  if (typeof password !== 'string' || password.length < 8) {
    // 例: 最低8文字
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters long',
    });
  }
  // name は任意なのでチェックは緩め (必要なら追加)
  const optionalName = typeof name === 'string' ? name : null;

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
    // Argon2id を使用 (oslo/password の内部実装に近い)
    const hashedPassword = await hash(password, {
      // Argon2 パラメータ (デフォルト推奨)
      memoryCost: 19456, // 19 MiB
      timeCost: 2,
      parallelism: 1,
    });

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
            data: JSON.stringify(defaultSettingsData), // デフォルト設定
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

    console.log(`User created successfully: ${email}`);
    // サインアップ成功レスポンス (自動ログインさせない場合)
    return { success: true };
  } catch (error: any) {
    console.error('Signup error:', error);

    // エラーが createError で作成されたものならそのまま投げる
    if (error.statusCode) {
      throw error;
    }

    // その他の予期せぬエラー
    throw createError({
      statusCode: 500,
      statusMessage: 'An internal server error occurred',
    });
  }
});

// --- デフォルトデータの定義 ---
// 実際のデフォルト値に置き換えてください
const defaultLayoutData = [
  {
    id: 'pane-1',
    size: 33.3,
    widgets: [
      /* 初期ウィジェット */
    ],
  },
  {
    id: 'pane-2',
    size: 33.3,
    widgets: [
      /* 初期ウィジェット */
    ],
  },
  {
    id: 'pane-3',
    size: 33.3,
    widgets: [
      /* 初期ウィジェット */
    ],
  },
];
const defaultSettingsData = {
  fontFamily: 'Arial',
  fontSize: 14,
  backgroundColor: '#ffffff',
};
