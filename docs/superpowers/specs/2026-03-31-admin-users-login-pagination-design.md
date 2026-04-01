# Admin Users Tab — Login Tracking & Pagination

**Date:** 2026-03-31
**Status:** Approved
**Scope:** `AdminUsersTab`, `adminService`, `userService`, `types/admin`

---

## Overview

Enhance the admin users tab with:
1. `lastLoginAt` tracking written to Firestore on every sign-in
2. Two new table columns: "Last Login" and "Last Active"
3. A summary bar showing Total Users, "Active 7d (newest 50)", and "Logged in 7d (newest 50)"
4. Cursor-based Firestore pagination (50 per page)
5. Server-side prefix search on `displayName` and `email`

---

## Data Layer

### 1. `lastLoginAt` field on `users/{uid}`

- Type: Firestore `Timestamp`
- Written by: `userService.updateLastLogin(uid)` using `serverTimestamp()`
- **Call site:** Inside `signInWithGoogle()` in `AuthContext`, immediately after `signInWithPopup` resolves successfully — NOT in `onAuthStateChanged` (which fires on every page refresh, not just on fresh sign-ins). The `UserCredential` must be captured: `const { user } = await signInWithPopup(auth, provider)`, then call `updateLastLogin(user.uid)`. Do NOT use `auth.currentUser` as a fallback — that would introduce a race condition.
- **Firestore security rule:** `lastLoginAt` is NOT in the blocked set `['role', 'status', 'plan']` at `users/{userId}`. The self-write `allow update` rule (lines 65–68 of `firestore.rules`) uses `affectedKeys().hasAny(['role', 'status', 'plan'])` — a deny-if-touching check — so writing `lastLoginAt` is implicitly permitted. No rule change is needed.
- Existing users who have not re-signed-in since deploy: field is absent → display as "Never"

### 2. `AdminUserView` type (`src/types/admin.ts`)

Add one optional field:

```ts
lastLoginAt?: Timestamp;
```

### 3. `adminService.getAllUsers` — paginated

New signature:

```ts
getAllUsers(
  pageSize: number,
  cursor?: DocumentSnapshot
): Promise<{ users: AdminUserView[], lastDoc: DocumentSnapshot | null }>
```

- Imports `DocumentSnapshot` from `firebase/firestore` (add to existing imports in `adminService.ts`)
- Orders by `joinedAt DESC`
- Applies `limit(pageSize)`
- Applies `startAfter(cursor)` when a cursor is provided
- Returns both the users array and the last document snapshot for the next-page cursor
- Single-field index on `joinedAt` is auto-created by Firestore; no manual index needed
- **Missing `joinedAt` docs:** The `onUserCreated` Cloud Function sets `joinedAt` on all new users at signup, so all docs in production should have this field. Any legacy doc missing `joinedAt` will be silently excluded by the `orderBy` query — this is acceptable; a note in code is sufficient.

### 4. `adminService.searchUsers` — server-side prefix search

```ts
searchUsers(term: string): Promise<AdminUserView[]>
```

- Runs two parallel Firestore queries:
  - `displayName >= term` AND `displayName <= term + '\uf8ff'` with `limit(50)`
  - `email >= term` AND `email <= term + '\uf8ff'` with `limit(50)`
- Merges results into a `Map<uid, AdminUserView>` — last-write-wins for the same uid (both queries return equivalent data for the same user, so ordering does not matter)
- Returns `Array.from(map.values())` sorted **client-side by `displayName` ASC** after the merge step, for a consistent and scannable result order
- No cursor/pagination applied during search — results are bounded by `limit(50)` per query
- Search resets to page 1 when the term changes

### Scalability

- Cursor pagination: O(pageSize) Firestore reads regardless of total collection size — scales to millions of docs
- Prefix search: covers 90% of real admin lookup patterns (name start or full email). Does not support mid-string search (e.g. "tam" won't find "Preetam"). Full-text search (Algolia) is out of scope.

---

## UI / Component Changes

### Summary bar (`AdminUsersTab`)

Displayed above the search field and table. Three stat chips:

| Stat | Source |
|---|---|
| Total Users | Fetched once via `adminService.getAppStats()` (already exists) |
| Active (7d) | Count of users in the first page where `lastChantDate` >= 7 days ago |
| Logged in (7d) | Count of users in the first page where `lastLoginAt` >= 7 days ago |

> Note: "Active (7d)" and "Logged in (7d)" counts reflect only the **50 most recently joined users** (first page, `joinedAt DESC`). They are a biased sample, not a global total. Labels must read **"Active 7d (newest 50)"** and **"Logged in 7d (newest 50)"** to make the scope explicit.

### Table columns

Existing columns: User, Role, Status, Plan, Joined, Actions — **total 6 columns**

New columns inserted before Actions — **new total 8 columns**:

| Column | Value | Fallback |
|---|---|---|
| Last Login | `lastLoginAt` formatted as relative time ("2 days ago") | "Never" |
| Last Active | `stats.lastChantDate` formatted as relative time | "Never" |

- The empty-state row `colSpan` must be updated from `6` to `8`
- Two empty-state messages: **"No users found matching your search."** (search mode) and **"No more users."** (paginated mode, last page)
- Relative time formatting: use a simple local helper (no external library) — buckets: "Today", "Yesterday", "N days ago", "N weeks ago", "Never"
- `lastChantDate` is stored as a `"YYYY-MM-DD"` string. The helper must parse it via `new Date(lastChantDate + 'T00:00:00')` (local midnight, not UTC midnight) to ensure "Today"/"Yesterday" buckets are correct for IST and other non-UTC timezones. `lastLoginAt` is a Firestore `Timestamp`; call `.toDate()` before computing relative time.

### Search behaviour

- Input debounced 300ms
- When `searchQuery` is empty: use paginated `getAllUsers`
- When `searchQuery` is non-empty: call `searchUsers(term)`, pagination controls hidden
- Clearing search returns to paginated view at page 1

### Pagination bar

Displayed below the table. Visible only when not in search mode.

- **Prev** button — disabled on page 1
- **Page N** label
- **Next** button — disabled when the last fetch returned fewer than `pageSize` results
- **Empty next-page case:** If Next is clicked and the fetch returns 0 results, render the "No more users." empty-state row, disable the Next button retrospectively, and do not advance the page counter
- Page state is local to the component; resets on tab switch

**Cursor stack for Prev navigation:**

Firestore cursor pagination is forward-only; Prev requires a cursor stack:

```ts
const [cursorStack, setCursorStack] = useState<DocumentSnapshot[]>([]); // one entry per completed page
const [currentCursor, setCurrentCursor] = useState<DocumentSnapshot | undefined>(undefined);
const [page, setPage] = useState(1);
```

- **Next:** push `lastDoc` of current page onto `cursorStack`, set `currentCursor = lastDoc`, increment `page`
- **Prev:** pop the last entry from `cursorStack`, then set `currentCursor = cursorStack[cursorStack.length - 1]` (i.e., the new top of the stack *after* the pop, or `undefined` if the stack is now empty), decrement `page`
- **Reset (search clears or tab switches):** empty `cursorStack`, set `currentCursor = undefined`, set `page = 1`

---

## Files Changed

| File | Change |
|---|---|
| `src/types/admin.ts` | Add `lastLoginAt?: Timestamp` to `AdminUserView` |
| `src/services/userService.ts` | Add `updateLastLogin(uid)` method |
| `src/contexts/AuthContext.tsx` | Call `updateLastLogin` after `signInWithPopup` resolves in `signInWithGoogle` (not in `onAuthStateChanged`) |
| `src/services/adminService.ts` | Add `DocumentSnapshot` to imports; refactor `getAllUsers` for cursor pagination; rewrite `searchUsers` for server-side prefix search |
| `src/admin/AdminUsersTab.tsx` | Add `DocumentSnapshot` import from `firebase/firestore`; refactor `fetchUsers` to destructure `{ users, lastDoc }` from `getAllUsers`; add summary bar; add Last Login/Last Active columns; update `colSpan` from 6 to 8; add cursor-stack state and pagination bar; wire debounced search with two empty-state messages |

---

## Out of Scope

- Full-text / mid-string search (requires Algolia)
- URL-based pagination state (admin panel only, no deep-linking needed)
- Backfilling `lastLoginAt` for existing users (they show "Never" until next sign-in)
- Cloud Function for login tracking (client-side write is sufficient)
- Firestore security rule changes (existing rule already permits `lastLoginAt` writes)
