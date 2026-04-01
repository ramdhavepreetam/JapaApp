import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime } from './formatRelativeTime';
import { Timestamp } from 'firebase/firestore';

// Fix "now" so tests are deterministic
const NOW = new Date('2026-03-31T12:00:00'); // local noon

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

describe('formatRelativeTime', () => {
  it('returns "Never" for null', () => {
    expect(formatRelativeTime(null)).toBe('Never');
  });

  it('returns "Never" for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('Never');
  });

  it('returns "Today" for a YYYY-MM-DD string matching today', () => {
    expect(formatRelativeTime('2026-03-31')).toBe('Today');
  });

  it('returns "Yesterday" for yesterday date string', () => {
    expect(formatRelativeTime('2026-03-30')).toBe('Yesterday');
  });

  it('returns "5 days ago" for 5 days prior date string', () => {
    expect(formatRelativeTime('2026-03-26')).toBe('5 days ago');
  });

  it('returns "1 week ago" for 7 days prior date string (singular)', () => {
    expect(formatRelativeTime('2026-03-24')).toBe('1 week ago');
  });

  it('returns "2 weeks ago" for 14 days prior date string', () => {
    expect(formatRelativeTime('2026-03-17')).toBe('2 weeks ago');
  });

  it('returns "Today" for a Firestore Timestamp for today', () => {
    const ts = Timestamp.fromDate(new Date('2026-03-31T08:00:00'));
    expect(formatRelativeTime(ts)).toBe('Today');
  });

  it('returns "Yesterday" for a Timestamp from yesterday', () => {
    const ts = Timestamp.fromDate(new Date('2026-03-30T10:00:00'));
    expect(formatRelativeTime(ts)).toBe('Yesterday');
  });

  it('returns "3 days ago" for a Timestamp 3 days prior', () => {
    const ts = Timestamp.fromDate(new Date('2026-03-28T10:00:00'));
    expect(formatRelativeTime(ts)).toBe('3 days ago');
  });
});
