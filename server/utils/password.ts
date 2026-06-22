// server/utils/password.ts
// パスワードハッシュ(Argon2id)の共通処理。login と signup でパラメータを一貫させる。

import { hash, verify } from '@node-rs/argon2';

// Argon2id パラメータ（OWASP 推奨に近い設定）。
// 変更時は既存ハッシュとの互換性に注意（パラメータはハッシュ文字列に埋め込まれるため、
// verify 側は格納時のパラメータを読み取る。新規ハッシュ生成にのみ影響する）。
export const ARGON2_PARAMS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_PARAMS);
}

export function verifyPassword(
  hashedPassword: string,
  password: string,
): Promise<boolean> {
  return verify(hashedPassword, password);
}

/**
 * アカウント不在時のタイミング攻撃(メール列挙)対策用のダミーハッシュ。
 * 同じ Argon2 パラメータで生成し、最初の不在時に遅延初期化してキャッシュする。
 * ログイン失敗パスで「存在しないアカウント」でも verify の計算コストを払い、
 * 応答時間の差を均すために使う（結果は破棄する）。
 */
let dummyHashPromise: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword('timing-attack-dummy-password');
  }
  return dummyHashPromise;
}
