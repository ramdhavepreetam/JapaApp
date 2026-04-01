# Admin Users Login Tracking & Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `lastLoginAt` tracking, Last Login/Last Active table columns, a summary bar, cursor-based pagination (50/page), and server-side prefix search to the admin users tab.

**Architecture:** `lastLoginAt` is written to Firestore inside `signInWithGoogle` (capturing the `UserCredential` from `signInWithPopup`). `adminService.getAllUsers` gains cursor-based pagination using Firestore's `startAfter`. A pure `formatRelativeTime` helper handles both `Timestamp` and `"YYYY-MM-DD"` string inputs. `AdminUsersTab` manages a cursor stack for Prev/Next navigation.

**Tech Stack:** React 18, TypeScript strict, Firebase Firestore client SDK, Material-UI 7, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/admin.ts` | Modify | Add `lastLoginAt?: Timestamp` to `AdminUserView` |
| `src/services/userService.ts` | Modify | Add `updateLastLogin(uid)` method |
| `src/contexts/AuthContext.tsx` | Modify | Call `updateLastLogin` after `signInWithPopup` resolves |
| `src/services/adminService.ts` | Modify | Cursor-paginated `getAllUsers`; server-side prefix `searchUsers` |
| `src/services/adminService.test.ts` | Modify | Tests for new `getAllUsers` + `searchUsers` signatures |
| `src/utils/formatRelativeTime.ts` | Create | Pure helper: `formatRelativeTime(value)` → `"Today" \| "2 days ago" \| "Never"` |
| `src/utils/formatRelativeTime.test.ts` | Create | Unit tests for the helper |
| `src/admin/AdminUsersTab.tsx` | Modify | Summary bar, new columns, pagination bar, debounced search |

---

## Task 1: Add `lastLoginAt` to `AdminUserView` type

**Files:**
- Modify: `src/types/admin.ts`

This is a one-line type change. No test needed — TypeScript will catch consumer mismatches at compile time in subsequent tasks.

- [ ] **Step 1: Add the field**

In `src/types/admin.ts`, add one optional field to `AdminUserView`:

```ts
export interface AdminUserView {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: 'active' | 'banned' | 'suspended';
  plan: 'free' | 'pro' | 'community';
  stats: {
    totalMalas: number;
    totalMantras: number;
    streakDays: number;
    lastChantDate: string | null;
  };
  joinedAt: Timestamp;
  lastLoginAt?: Timestamp;   // ← add this line
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/admin.ts
git commit -m "feat: add lastLoginAt field to AdminUserView type"
```

---

## Task 2: Add `updateLastLogin` to `userService`

**Files:**
- Modify: `src/services/userService.ts`

- [ ] **Step 1: Read the existing `userService` to understand the pattern**

Open `src/services/userService.ts` and note how `updateDoc` and `serverTimestamp` are already imported from `firebase/firestore`.

- [ ] **Step 2: Add `serverTimestamp` to the import if not already present**

`src/services/userService.ts` line 2 currently imports from `firebase/firestore`. Add `serverTimestamp` to that import if it isn't there already:

```ts
import { doc, getDoc, setDoc, updateDoc, increment, Timestamp, serverTimestamp } from 'firebase/firestore';
```

- [ ] **Step 3: Add the `updateLastLogin` method to `userService`**

Append inside the `userService` object, after `ensureUserExists`:

```ts
updateLastLogin: async (uid: string): Promise<void> => {
  try {
    // Deliberate exception to the project-wide runWithFallback rule:
    // this is a fire-and-forget write. Failure is non-fatal and must never
    // block the sign-in flow, so we swallow the error here rather than
    // routing through resilience.ts which would suppress it silently anyway.
    await updateDoc(doc(db, 'users', uid), {
      lastLoginAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('updateLastLogin failed (non-fatal):', err);
  }
},
```

> The try/catch is intentional: a failed `lastLoginAt` write must never block the sign-in flow. `runWithFallback` is intentionally omitted — this is a documented exception to the project-wide resilience rule.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/services/userService.ts
git commit -m "feat: add updateLastLogin to userService"
```

---

## Task 3: Wire `updateLastLogin` in `AuthContext`

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Import `userService` in `AuthContext`**

Add to the top of `src/contexts/AuthContext.tsx`:

```ts
import { userService } from '../services/userService';
```

- [ ] **Step 2: Capture `UserCredential` and call `updateLastLogin`**

In `signInWithGoogle`, change:

```ts
// Before:
await signInWithPopup(auth, provider);
```

to:

```ts
// After:
const { user } = await signInWithPopup(auth, provider);
// Fire-and-forget: update lastLoginAt. Non-critical — error is swallowed inside updateLastLogin.
userService.updateLastLogin(user.uid);
```

> Do NOT `await` this call here — it is non-critical and must not delay the sign-in flow.
> Do NOT use `auth.currentUser` instead of `user` from `UserCredential` — that would be a race condition.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: write lastLoginAt to Firestore on Google sign-in"
```

---

## Task 4: Refactor `adminService.getAllUsers` for cursor pagination

**Files:**
- Modify: `src/services/adminService.ts`
- Modify: `src/services/adminService.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/services/adminService.test.ts`, add `startAfter` to the **top-level `vi.mock('firebase/firestore', ...)` factory object** (the one already on lines 13–29). Add it alongside the other existing mock functions:

```ts
// Add only startAfter: vi.fn() to the existing top-level vi.mock factory.
// Do NOT add DocumentSnapshot — it is a type-only import, not a callable.
startAfter: vi.fn(),
```

Then add a new describe block:

```ts
describe('getAllUsers (paginated)', () => {
  it('returns users array and lastDoc on first page', async () => {
    const mockDocs = [
      { id: 'u1', data: () => ({ displayName: 'Alice', email: 'a@x.com', joinedAt: { toDate: () => new Date() } }) },
      { id: 'u2', data: () => ({ displayName: 'Bob',   email: 'b@x.com', joinedAt: { toDate: () => new Date() } }) },
    ];
    const { getDocs, query } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: mockDocs } as any);
    vi.mocked(query).mockReturnValue({} as any);

    const result = await adminService.getAllUsers(50);

    expect(result).toHaveProperty('users');
    expect(result).toHaveProperty('lastDoc');
    expect(result.users).toHaveLength(2);
    expect(result.lastDoc).toBe(mockDocs[1]); // last doc in results
  });

  it('passes cursor to startAfter when provided', async () => {
    const { getDocs, query, startAfter } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);
    vi.mocked(query).mockReturnValue({} as any);
    const fakeCursor = { id: 'cursor-doc' } as any;

    await adminService.getAllUsers(50, fakeCursor);

    expect(startAfter).toHaveBeenCalledWith(fakeCursor);
  });

  it('returns lastDoc as null when no results', async () => {
    const { getDocs, query } = await import('firebase/firestore');
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as any);
    vi.mocked(query).mockReturnValue({} as any);

    const result = await adminService.getAllUsers(50);

    expect(result.lastDoc).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --reporter=verbose src/services/adminService.test.ts 2>&1 | tail -20
```
Expected: FAIL — `getAllUsers` returns `AdminUserView[]` not `{ users, lastDoc }`.

- [ ] **Step 3: Update `adminService.getAllUsers`**

In `src/services/adminService.ts`:

1. Add `DocumentSnapshot` and `startAfter` to the `firebase/firestore` import:

```ts
import {
  collection, doc, getDocs, getDoc, query, where, limit,
  serverTimestamp, writeBatch, Timestamp, orderBy,
  getCountFromServer, DocumentSnapshot, startAfter
} from 'firebase/firestore';
```

2. Replace the `getAllUsers` method:

```ts
getAllUsers: async (
  pageSize: number = 50,
  cursor?: DocumentSnapshot
): Promise<{ users: AdminUserView[]; lastDoc: DocumentSnapshot | null }> => {
  // Note: docs missing 'joinedAt' are silently excluded by orderBy — acceptable,
  // as onUserCreated Cloud Function sets joinedAt on all new signups.
  // IMPORTANT: startAfter must be added BEFORE limit, or Firestore clips
  // results before applying the cursor, giving wrong pages.
  const constraints: any[] = [orderBy('joinedAt', 'desc')];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize));
  const q = query(collection(db, 'users'), ...constraints);
  const snap = await getDocs(q);

  const users = snap.docs.map(d => {
    const data = d.data();
    return {
      uid: d.id,
      displayName: data.displayName || 'Unknown User',
      email: data.email || 'No Email',
      role: data.role || 'user',
      status: data.status || 'active',
      plan: data.plan || 'free',
      stats: data.stats || { totalMalas: 0, totalMantras: 0, streakDays: 0, lastChantDate: null },
      joinedAt: data.joinedAt || Timestamp.now(),
      lastLoginAt: data.lastLoginAt,
    } as AdminUserView;
  });

  const lastDoc = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
  return { users, lastDoc };
},
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose src/services/adminService.test.ts 2>&1 | tail -20
```
Expected: all tests PASS including the new ones.

- [ ] **Step 5: Commit**

```bash
git add src/services/adminService.ts src/services/adminService.test.ts
git commit -m "feat: cursor-based pagination for adminService.getAllUsers"
```

---

## Task 5: Rewrite `adminService.searchUsers` for server-side prefix search

**Files:**
- Modify: `src/services/adminService.ts`
- Modify: `src/services/adminService.test.ts`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `adminService.test.ts`:

```ts
describe('searchUsers (server-side prefix)', () => {
  it('merges and deduplicates results from displayName and email queries', async () => {
    const { getDocs, query } = await import('firebase/firestore');
    // First call returns displayName match; second call returns email match for same user
    const sharedDoc = { id: 'u1', data: () => ({ displayName: 'Alice', email: 'alice@x.com' }) };
    vi.mocked(getDocs)
      .mockResolvedValueOnce({ docs: [sharedDoc] } as any)  // displayName query
      .mockResolvedValueOnce({ docs: [sharedDoc] } as any); // email query
    vi.mocked(query).mockReturnValue({} as any);

    const results = await adminService.searchUsers('ali');

    // Deduplicated: same uid appears only once
    expect(results).toHaveLength(1);
    expect(results[0].uid).toBe('u1');
  });

  it('returns results sorted by displayName ASC', async () => {
    const { getDocs, query } = await import('firebase/firestore');
    vi.mocked(getDocs)
      .mockResolvedValueOnce({ docs: [
        { id: 'u2', data: () => ({ displayName: 'Zara', email: 'z@x.com' }) },
        { id: 'u1', data: () => ({ displayName: 'Alice', email: 'a@x.com' }) },
      ] } as any)
      .mockResolvedValueOnce({ docs: [] } as any);
    vi.mocked(query).mockReturnValue({} as any);

    const results = await adminService.searchUsers('a');

    expect(results[0].displayName).toBe('Alice');
    expect(results[1].displayName).toBe('Zara');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --reporter=verbose src/services/adminService.test.ts 2>&1 | tail -20
```
Expected: FAIL — current `searchUsers` does not use server-side prefix queries.

- [ ] **Step 3: Rewrite `searchUsers`**

Replace the existing `searchUsers` method in `src/services/adminService.ts`:

```ts
searchUsers: async (term: string): Promise<AdminUserView[]> => {
  const end = term + '\uf8ff';
  const toView = (d: any): AdminUserView => {
    const data = d.data();
    return {
      uid: d.id,
      displayName: data.displayName || 'Unknown User',
      email: data.email || 'No Email',
      role: data.role || 'user',
      status: data.status || 'active',
      plan: data.plan || 'free',
      stats: data.stats || { totalMalas: 0, totalMantras: 0, streakDays: 0, lastChantDate: null },
      joinedAt: data.joinedAt || Timestamp.now(),
      lastLoginAt: data.lastLoginAt,
    };
  };

  const [nameSnap, emailSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'users'),
      where('displayName', '>=', term),
      where('displayName', '<=', end),
      limit(50)
    )),
    getDocs(query(
      collection(db, 'users'),
      where('email', '>=', term),
      where('email', '<=', end),
      limit(50)
    )),
  ]);

  const map = new Map<string, AdminUserView>();
  for (const d of nameSnap.docs) map.set(d.id, toView(d));
  for (const d of emailSnap.docs) map.set(d.id, toView(d));

  return Array.from(map.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
},
```

- [ ] **Step 4: Run all tests**

```bash
npm run test -- --reporter=verbose src/services/adminService.test.ts 2>&1 | tail -30
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/adminService.ts src/services/adminService.test.ts
git commit -m "feat: server-side prefix search in adminService.searchUsers"
```

---

## Task 6: Create `formatRelativeTime` helper

**Files:**
- Create: `src/utils/formatRelativeTime.ts`
- Create: `src/utils/formatRelativeTime.test.ts`

This is a pure function — test it thoroughly before writing the implementation.

- [ ] **Step 1: Write the failing tests**

Create `src/utils/formatRelativeTime.test.ts`:

```ts
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

  it('returns "2 weeks ago" for 14 days prior date string', () => {
    expect(formatRelativeTime('2026-03-17')).toBe('2 weeks ago');
  });

  it('returns "1 week ago" for 7 days prior date string (singular)', () => {
    expect(formatRelativeTime('2026-03-24')).toBe('1 week ago');
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test -- --reporter=verbose src/utils/formatRelativeTime.test.ts 2>&1 | tail -20
```
Expected: FAIL — file does not exist yet.

- [ ] **Step 3: Create the helper**

Create `src/utils/formatRelativeTime.ts`:

```ts
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
  if (value instanceof Timestamp) {
    date = value.toDate();
  } else {
    // Parse as local midnight to keep "Today"/"Yesterday" correct in IST and other non-UTC zones
    date = new Date(value + 'T00:00:00');
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
  const weeks = Math.round(diffDays / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test -- --reporter=verbose src/utils/formatRelativeTime.test.ts 2>&1 | tail -20
```
Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatRelativeTime.ts src/utils/formatRelativeTime.test.ts
git commit -m "feat: add formatRelativeTime helper with full test coverage"
```

---

## Task 7: Update `AdminUsersTab` — columns, summary bar, pagination, search

**Files:**
- Modify: `src/admin/AdminUsersTab.tsx`

This task rewrites the component. Read the current file in full before starting.

- [ ] **Step 1: Read the current component**

Open `src/admin/AdminUsersTab.tsx` and confirm the current structure (fetching, dialogs, table shape).

- [ ] **Step 2: Add imports**

Replace/extend the existing imports at the top of `AdminUsersTab.tsx`:

```tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Avatar,
  Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert
} from '@mui/material';
import { DocumentSnapshot } from 'firebase/firestore';
import { adminService } from '../services/adminService';
import { AdminUserView } from '../types/admin';
import { UserRole } from '../types/auth';
import { formatRelativeTime } from '../utils/formatRelativeTime';
```

- [ ] **Step 3: Replace state declarations**

Replace the existing state at the top of the component function body:

```tsx
const PAGE_SIZE = 50;

const [users, setUsers] = useState<AdminUserView[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [totalUsers, setTotalUsers] = useState<number | null>(null);

// Pagination cursor stack
const [cursorStack, setCursorStack] = useState<DocumentSnapshot[]>([]);
const [currentCursor, setCurrentCursor] = useState<DocumentSnapshot | undefined>(undefined);
const [page, setPage] = useState(1);
const [isLastPage, setIsLastPage] = useState(false);

// Search debounce
const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const [isSearchMode, setIsSearchMode] = useState(false);
```

Keep the existing dialog state (`banDialogOpen`, `selectedUser`, etc.) unchanged.

Also **remove the `filteredUsers` derived variable** (lines 87–90 in the original file) — it client-side filtered `users` by `searchQuery`. The new model uses server-side search; keeping `filteredUsers` will cause an ESLint "unused variable" error (this project treats warnings as errors).

- [ ] **Step 4: Rewrite `fetchUsers` and add `fetchTotalUsers`**

Replace the `fetchUsers` function and `useEffect`:

```tsx
const fetchUsers = async (cursor?: DocumentSnapshot) => {
  try {
    setLoading(true);
    setError(null);
    const { users: data, lastDoc } = await adminService.getAllUsers(PAGE_SIZE, cursor);
    setUsers(data);
    // Store lastDoc so handleNextPage knows where page 1 ends
    setCurrentCursor(lastDoc ?? undefined);
    setIsLastPage(data.length < PAGE_SIZE || lastDoc === null);
    // After first page load, also fetch total user count for summary bar
    if (!cursor) {
      adminService.getAppStats().then(stats => setTotalUsers(stats.totalUsers)).catch(() => {});
    }
  } catch (err: any) {
    setError(err.message || 'Failed to fetch users');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchUsers();
}, []);
```

- [ ] **Step 5: Add search handler with debounce**

Add after the `fetchUsers` function:

```tsx
const handleSearchChange = (value: string) => {
  setSearchQuery(value);
  if (debounceRef.current) clearTimeout(debounceRef.current);

  if (!value.trim()) {
    // Returning to paginated mode — reset
    setIsSearchMode(false);
    setCursorStack([]);
    setCurrentCursor(undefined);
    setPage(1);
    setIsLastPage(false);
    fetchUsers(undefined);
    return;
  }

  debounceRef.current = setTimeout(async () => {
    try {
      setLoading(true);
      setIsSearchMode(true);
      setIsLastPage(false);
      const results = await adminService.searchUsers(value.trim());
      setUsers(results);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, 300);
};
```

- [ ] **Step 6: Add pagination handlers**

```tsx
const handleNextPage = async () => {
  if (isLastPage) return;
  try {
    setLoading(true);
    const { users: data, lastDoc } = await adminService.getAllUsers(PAGE_SIZE, currentCursor);
    if (data.length === 0) {
      setIsLastPage(true);
      return; // don't advance page counter; table shows "No more users."
    }
    // Push current cursor onto stack before advancing
    setCursorStack(prev => currentCursor ? [...prev, currentCursor] : prev);
    setCurrentCursor(lastDoc ?? undefined);
    setUsers(data);
    setIsLastPage(data.length < PAGE_SIZE);
    setPage(prev => prev + 1);
  } catch (err: any) {
    setError(err.message || 'Failed to load next page');
  } finally {
    setLoading(false);
  }
};

const handlePrevPage = async () => {
  if (page <= 1) return;
  try {
    setLoading(true);
    const newStack = [...cursorStack];
    newStack.pop(); // remove the cursor we used to reach the current page
    // After pop, use the new top of the stack (not the popped value) as the cursor
    const prevCursor = newStack.length > 0 ? newStack[newStack.length - 1] : undefined;
    const { users: data, lastDoc } = await adminService.getAllUsers(PAGE_SIZE, prevCursor);
    setCursorStack(newStack);
    setCurrentCursor(lastDoc ?? undefined);
    setUsers(data);
    setIsLastPage(false);
    setPage(prev => prev - 1);
  } catch (err: any) {
    setError(err.message || 'Failed to load previous page');
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 7: Add summary bar computed values**

Add these derived values after the handlers (before the return):

```tsx
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const activeCount = users.filter(u => {
  if (!u.stats.lastChantDate) return false;
  return new Date(u.stats.lastChantDate + 'T00:00:00') >= sevenDaysAgo;
}).length;

const loggedInCount = users.filter(u => {
  if (!u.lastLoginAt) return false;
  return u.lastLoginAt.toDate() >= sevenDaysAgo;
}).length;
```

- [ ] **Step 8: Rewrite the JSX return**

Replace the entire `return (...)` with:

```tsx
if (loading && users.length === 0) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
if (error) return <Alert severity="error">{error}</Alert>;

return (
  <Box>
    {/* Summary bar */}
    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
      <Chip label={`Total Users: ${totalUsers ?? '…'}`} variant="outlined" />
      <Chip label={`Active 7d (newest 50): ${activeCount}`} color="success" variant="outlined" />
      <Chip label={`Logged in 7d (newest 50): ${loggedInCount}`} color="primary" variant="outlined" />
    </Box>

    {/* Search + heading */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
      <Typography variant="h6">Manage Users</Typography>
      <TextField
        size="small"
        placeholder="Search by name or email (prefix)…"
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        sx={{ width: 300 }}
      />
    </Box>

    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size="small" sx={{ minWidth: 700 }}>
        <TableHead>
          <TableRow sx={{ bgcolor: 'grey.100' }}>
            <TableCell>User</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Plan</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell>Last Login</TableCell>
            <TableCell>Last Active</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                <CircularProgress size={24} />
              </TableCell>
            </TableRow>
          )}
          {!loading && users.map((user) => (
            <TableRow key={user.uid}>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ width: 32, height: 32, mr: 2 }}>{user.displayName.charAt(0)}</Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{user.displayName}</Typography>
                    <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                  </Box>
                </Box>
              </TableCell>
              <TableCell>
                <Chip size="small" label={user.role} color={user.role === 'superadmin' ? 'secondary' : 'default'} />
              </TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={user.status}
                  color={user.status === 'banned' ? 'error' : 'success'}
                />
              </TableCell>
              <TableCell>{user.plan}</TableCell>
              <TableCell>{user.joinedAt?.toDate().toLocaleDateString()}</TableCell>
              <TableCell>
                <Typography variant="body2" color={user.lastLoginAt ? 'text.primary' : 'text.disabled'}>
                  {formatRelativeTime(user.lastLoginAt)}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2" color={user.stats.lastChantDate ? 'text.primary' : 'text.disabled'}>
                  {formatRelativeTime(user.stats.lastChantDate)}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => handleRoleClick(user)}>Role</Button>
                {user.status === 'banned' ? (
                  <Button size="small" color="success" onClick={() => handleUnbanClick(user)}>Unban</Button>
                ) : (
                  <Button size="small" color="error" onClick={() => handleBanClick(user)}>Ban</Button>
                )}
              </TableCell>
            </TableRow>
          ))}
          {!loading && users.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                {isSearchMode ? 'No users found matching your search.' : 'No more users.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>

    {/* Pagination bar — hidden in search mode */}
    {!isSearchMode && (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2, gap: 2 }}>
        <Button size="small" variant="outlined" onClick={handlePrevPage} disabled={page <= 1}>
          Prev
        </Button>
        <Typography variant="body2">Page {page}</Typography>
        <Button size="small" variant="outlined" onClick={handleNextPage} disabled={isLastPage}>
          Next
        </Button>
      </Box>
    )}

    {/* Ban Dialog — unchanged */}
    <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)}>
      <DialogTitle>Ban User</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Are you sure you want to ban {selectedUser?.displayName}? They will not be able to access the app.
        </Typography>
        <TextField
          fullWidth
          size="small"
          label="Reason for banning"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setBanDialogOpen(false)}>Cancel</Button>
        <Button onClick={handleConfirmBan} color="error" variant="contained" disabled={!banReason.trim()}>
          Confirm Ban
        </Button>
      </DialogActions>
    </Dialog>

    {/* Role Assignment Dialog — unchanged */}
    <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
      <DialogTitle>Assign Role</DialogTitle>
      <DialogContent sx={{ minWidth: 300 }}>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Change role for {selectedUser?.displayName}.
        </Typography>
        <FormControl fullWidth size="small">
          <InputLabel>Role</InputLabel>
          <Select
            value={selectedRole}
            label="Role"
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
          >
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="community_admin">Community Admin</MenuItem>
            <MenuItem value="superadmin">Superadmin</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
        <Button onClick={handleConfirmRole} color="primary" variant="contained">
          Save Role
        </Button>
      </DialogActions>
    </Dialog>
  </Box>
);
```

- [ ] **Step 9: Run TypeScript build**

```bash
npm run build 2>&1 | head -40
```
Expected: no errors.

- [ ] **Step 10: Run all tests**

```bash
npm run test 2>&1 | tail -20
```
Expected: all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/admin/AdminUsersTab.tsx
git commit -m "feat: add pagination, login/active columns, and summary bar to AdminUsersTab"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
npm run test 2>&1 | tail -30
```
Expected: all tests PASS, no failures.

- [ ] **Step 2: Run lint**

```bash
npm run lint 2>&1 | tail -20
```
Expected: no errors (warnings treated as errors in this project).

- [ ] **Step 3: Run build**

```bash
npm run build 2>&1 | tail -20
```
Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Final commit if any lint fixes were needed**

```bash
git add -p   # review any lint-fix changes
git commit -m "fix: lint issues from admin users tab changes"
```
(Skip this step if lint was already clean.)
