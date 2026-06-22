// server/utils/calendar.ts
// カレンダーウィジェットの iframeTag をサーバー側で検証する（多層防御）。
// クライアント(CalendarWidget)での DOMPurify サニタイズとは別に、
// 不正な iframe ソースを DB に蓄積しないための最終チェック。

import {
  isAllowedCalendarSrc,
  MAX_CALENDAR_IFRAME_TAG_LENGTH,
} from '~/utils/calendarHosts';

export type CalendarValidation = { ok: true } | { ok: false; reason: string };

/**
 * iframeTag を検証する。
 * - 空文字/空白のみは「未設定」として許可（クライアント側で案内表示される）
 * - 長すぎる場合は拒否（保存上限）
 * - iframe タグを含まない場合は拒否
 * - 全 src 属性の URL が Google Calendar 許可ホスト(HTTPS)であることを検証
 */
export function validateCalendarIframeTag(tag: string): CalendarValidation {
  if (tag.length > MAX_CALENDAR_IFRAME_TAG_LENGTH) {
    return {
      ok: false,
      reason: 'Calendar iframe tag is too long.',
    };
  }

  if (tag.trim() === '') {
    return { ok: true }; // 未設定は許可
  }

  if (!/<iframe[\s>]/i.test(tag)) {
    return {
      ok: false,
      reason: 'Calendar widget requires an <iframe> tag.',
    };
  }

  // src 属性を抽出し、すべて許可ホストを指すことを検証する。
  // src="..." / src='...' / src=bare の各形式をカバー。
  const srcRegex = /src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = srcRegex.exec(tag)) !== null) {
    const src = match[1] ?? match[2] ?? match[3] ?? '';
    if (!isAllowedCalendarSrc(src)) {
      return {
        ok: false,
        reason: 'Calendar iframe src must point to Google Calendar over HTTPS.',
      };
    }
  }

  return { ok: true };
}
