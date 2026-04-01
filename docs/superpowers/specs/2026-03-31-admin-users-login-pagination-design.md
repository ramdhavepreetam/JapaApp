# Admin Users Tab — Login Tracking & Pagination

**Date:** 2026-03-31
**Status:** Approved
**Scope:** `AdminUsersTab`, `adminService`, `userService`, `types/admin`

---

## Overview

Enhance the admin users tab with:
1. `lastLoginAt` tracking written to Firestore on every sign-in
2. Two new table columns: "Last Login" and "Last Active"
3. An active-users summary bar at the top of the tab
4. Cursor-based Firestore pagination (50 per page)
5. Server-side prefix search on `displayName` and `email`

---

## Data Layer

### 1. `lastLoginAt` field on `users/{uid}`

- Type: Firestore `Timestamp`
- Written by: `userService.updateLastLogin(uid)` using `serverTimestamp()`
- Called from: `AuthContext` immediately after a successful sign-in (alongside existing profile fetch)
- Existing users who have not re-signed-in: field is absent → display as "Never"

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

- Orders by `joinedAt DESC`
- Applies `limit(pageSize)`
- Applies `startAfter(cursor)` when a cursor is provided
- Returns both the users array and the last document snapshot for the next-page cursor
- Single-field index on `joinedAt` is auto-created by Firestore; no manual index needed

### 4. `adminService.searchUsers` — server-side prefix search

```ts
searchUsers(term: string): Promise<AdminUserView[]>
```

- Runs two parallel Firestore queries:
  - `displayName >= term` AND `displayName <= term + '\uf8ff'` with `limit(50)`
  - `email >= term` AND `email <= term + '\uf8ff'` with `limit(50)`
- Merges and deduplicates results by `uid`
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
| Active (7d) | Users where `lastChantDate` >= 7 days ago, counted client-side from current page load |
| Logged in (7d) | Users where `lastLoginAt` >= 7 days ago, counted client-side from current page load |

> Note: "Active (7d)" and "Logged in (7d)" counts are computed from the full fetched set at load time (first page), not the entire database. This is an acceptable approximation for the admin panel.

### Table columns

Existing columns: User, Role, Status, Plan, Joined, Actions

New columns inserted before Actions:

| Column | Value | Fallback |
|---|---|---|
| Last Login | `lastLoginAt` formatted as relative time ("2 days ago") | "Never" |
| Last Active | `stats.lastChantDate` formatted as relative time | "Never" |

Relative time formatting: use a simple local helper (no external library) — buckets: "Today", "Yesterday", "N days ago", "N weeks ago", "Never".

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
- Page state is local to the component; resets on tab switch

---

## Files Changed

| File | Change |
|---|---|
| `src/types/admin.ts` | Add `lastLoginAt?: Timestamp` to `AdminUserView` |
| `src/services/userService.ts` | Add `updateLastLogin(uid)` method |
| `src/contexts/AuthContext.tsx` | Call `updateLastLogin` after successful sign-in |
| `src/services/adminService.ts` | Refactor `getAllUsers` for cursor pagination; update `searchUsers` for server-side prefix search |
| `src/admin/AdminUsersTab.tsx` | Add summary bar, Last Login/Last Active columns, pagination bar, debounced search wiring |

---

## Out of Scope

- Full-text / mid-string search (requires Algolia)
- URL-based pagination state (admin panel only, no deep-linking needed)
- Backfilling `lastLoginAt` for existing users (they show "Never" until next sign-in)
- Cloud Function for login tracking (client-side write is sufficient)
