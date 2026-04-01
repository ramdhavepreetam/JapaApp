import { Timestamp } from 'firebase/firestore';

/**
 * Formats a date value as a human-readable relative string.
 *
 * Accepts:
 *   - A Firestore Timestamp  → call .toDate() first
 *   - A "YYYY-MM-DD" string  → parsed as local midnight (T00:00:00) to avoid UTC offset issues
 *   - null / undefined       → "Never"
 */
export function formatRelativeTime(
  value: Timestamp | string | null | undefined
): string {
  if (value == null) return 'Never';

  let date: Date;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    // It's a Firestore Timestamp (or duck-typed as one)
    date = (value as any).toDate();
  } else if (typeof value === 'string') {
    // Parse as local midnight to keep "Today"/"Yesterday" correct in IST and other non-UTC zones
    date = new Date(value + 'T00:00:00');
  } else {
    return 'Never';
  }

  if (isNaN(date.getTime())) return 'Never';

  const now = new Date();
  // Compare calendar days in local time by zeroing to midnight
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (todayMidnight.getTime() - dateMidnight.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  const weeks = Math.floor(diffDays / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
}
