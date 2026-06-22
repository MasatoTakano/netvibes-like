// utils/__tests__/calendarHosts.spec.ts
import { describe, it, expect } from 'vitest';
import {
  isAllowedCalendarSrc,
  ALLOWED_CALENDAR_HOSTS,
  MAX_CALENDAR_IFRAME_TAG_LENGTH,
} from '~/utils/calendarHosts';

describe('isAllowedCalendarSrc', () => {
  it('allows https calendar.google.com URLs', () => {
    expect(
      isAllowedCalendarSrc(
        'https://calendar.google.com/calendar/embed?src=user@gmail.com',
      ),
    ).toBe(true);
  });

  it('allows https www.google.com/calendar paths', () => {
    expect(
      isAllowedCalendarSrc('https://www.google.com/calendar/embed?src=x'),
    ).toBe(true);
  });

  it('rejects http (non-https)', () => {
    expect(
      isAllowedCalendarSrc('http://calendar.google.com/calendar/embed'),
    ).toBe(false);
  });

  it('rejects www.google.com paths outside /calendar/', () => {
    expect(isAllowedCalendarSrc('https://www.google.com/search')).toBe(false);
  });

  it('rejects disallowed hosts (XSS / open-redirect attempts)', () => {
    expect(isAllowedCalendarSrc('https://evil.example.com/embed')).toBe(false);
    expect(isAllowedCalendarSrc('https://attacker.net/calendar/embed')).toBe(
      false,
    );
  });

  it('rejects javascript: and other non-http schemes', () => {
    expect(isAllowedCalendarSrc('javascript:alert(1)')).toBe(false);
    expect(isAllowedCalendarSrc('data:text/html,<script>1</script>')).toBe(
      false,
    );
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedCalendarSrc('not a url')).toBe(false);
    expect(isAllowedCalendarSrc('')).toBe(false);
  });

  it('exposes a frozen host allowlist and length cap', () => {
    expect(Object.isFrozen(ALLOWED_CALENDAR_HOSTS)).toBe(true);
    expect(ALLOWED_CALENDAR_HOSTS).toContain('calendar.google.com');
    expect(MAX_CALENDAR_IFRAME_TAG_LENGTH).toBeGreaterThan(0);
  });
});
