// utils/calendarHosts.ts
// Google Calendar iframe の許可ホスト判定。
// クライアント(CalendarWidget のサニタイズ)とサーバー(layout 保存時の検証)で
// 単一ソースとして参照する。DOM 非依存の純粋関数のみで構成。

export const ALLOWED_CALENDAR_HOSTS: Readonly<string[]> = Object.freeze([
  'calendar.google.com',
  'www.google.com',
]);

// iframeTag の保存上限（DoS/不正データ蓄積防止）
export const MAX_CALENDAR_IFRAME_TAG_LENGTH = 2000;

/**
 * 指定された src URL が Google Calendar の許可ホスト(HTTPS)を指しているか検証する。
 * - https 限定
 * - calendar.google.com 全体、または www.google.com/calendar/* のみ許可
 */
export function isAllowedCalendarSrc(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:') return false;
    if (!ALLOWED_CALENDAR_HOSTS.includes(url.hostname)) return false;
    return (
      url.hostname === 'calendar.google.com' ||
      (url.hostname === 'www.google.com' &&
        url.pathname.startsWith('/calendar/'))
    );
  } catch {
    return false;
  }
}
