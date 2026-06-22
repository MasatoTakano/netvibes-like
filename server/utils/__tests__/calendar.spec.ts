// server/utils/__tests__/calendar.spec.ts
import { describe, it, expect } from 'vitest';
import { validateCalendarIframeTag } from '~/server/utils/calendar';

describe('validateCalendarIframeTag', () => {
  const validGoogleEmbed =
    '<iframe src="https://calendar.google.com/calendar/embed?src=user@gmail.com" style="border:0" width="800" height="600" frameborder="0" scrolling="no"></iframe>';

  it('accepts a legitimate Google Calendar embed', () => {
    expect(validateCalendarIframeTag(validGoogleEmbed)).toEqual({ ok: true });
  });

  it('accepts empty/whitespace (unset widget)', () => {
    expect(validateCalendarIframeTag('')).toEqual({ ok: true });
    expect(validateCalendarIframeTag('   ')).toEqual({ ok: true });
  });

  it('rejects a tag longer than the cap', () => {
    const longSrc = 'https://calendar.google.com/calendar/embed?x=' + 'a'.repeat(3000);
    expect(validateCalendarIframeTag(`<iframe src="${longSrc}"></iframe>`).ok).toBe(
      false,
    );
  });

  it('rejects content without an iframe tag', () => {
    const r = validateCalendarIframeTag('<div>not an iframe</div>');
    expect(r.ok).toBe(false);
  });

  it('rejects iframes pointing to disallowed hosts', () => {
    const r = validateCalendarIframeTag(
      '<iframe src="https://evil.example.com/embed"></iframe>',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects javascript: src', () => {
    const r = validateCalendarIframeTag(
      '<iframe src="javascript:alert(1)"></iframe>',
    );
    expect(r.ok).toBe(false);
  });

  it('rejects http (non-https) src', () => {
    const r = validateCalendarIframeTag(
      '<iframe src="http://calendar.google.com/calendar/embed"></iframe>',
    );
    expect(r.ok).toBe(false);
  });

  it('handles single-quoted and bare src attributes', () => {
    expect(
      validateCalendarIframeTag(
        `<iframe src='https://calendar.google.com/calendar/embed?src=x'></iframe>`,
      ),
    ).toEqual({ ok: true });
  });
});
