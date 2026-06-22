// server/utils/__tests__/clientIp.spec.ts
import { describe, it, expect } from 'vitest';
import { pickTrustedClientIp } from '~/server/utils/clientIp';

describe('pickTrustedClientIp', () => {
  it('returns the single XFF entry when only one is present', () => {
    expect(
      pickTrustedClientIp({
        xForwardedFor: '203.0.113.5',
        socketRemoteAddress: '10.0.0.2',
      }),
    ).toBe('203.0.113.5');
  });

  it('uses the LAST (proxy-appended) entry, not the spoofable first', () => {
    // 攻撃者が先頭に任意の値を仕込んでも、プロキシが末尾に追記した実IPを採用する
    expect(
      pickTrustedClientIp({
        xForwardedFor: '999.999.999.999, 203.0.113.9',
        socketRemoteAddress: '10.0.0.2',
      }),
    ).toBe('203.0.113.9');
  });

  it('trims whitespace around entries', () => {
    expect(
      pickTrustedClientIp({ xForwardedFor: 'a , b ,  c ' }),
    ).toBe('c');
  });

  it('falls back to socket remote address when XFF absent', () => {
    expect(
      pickTrustedClientIp({
        socketRemoteAddress: '198.51.100.7',
      }),
    ).toBe('198.51.100.7');
  });

  it('falls back to "unknown" when nothing is available', () => {
    expect(pickTrustedClientIp({})).toBe('unknown');
    expect(
      pickTrustedClientIp({ xForwardedFor: '', socketRemoteAddress: null }),
    ).toBe('unknown');
  });

  it('ignores XFF when it contains only empty/whitespace segments', () => {
    expect(
      pickTrustedClientIp({
        xForwardedFor: ' , ',
        socketRemoteAddress: '198.51.100.7',
      }),
    ).toBe('198.51.100.7');
  });
});
