# ADR-0009: Feed / Posts Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Community Feed & Announcements

---

## Context

Community admins need to make announcements; all members need to post text/image content. The feed must support pagination, moderation, daily rate limiting, and type-based filtering (announcement vs. regular post).

## Decision

### Polling, not real-time

`communityFeedService.listPosts()` uses `getDocs` (one-time read), not `onSnapshot`. Posts are refetched on tab focus or user action. This reduces Firestore read costs significantly compared to persistent listeners on potentially long post lists.

### Denormalized author object

Each post stores a full `author: UserProfileSummary` object (uid, displayName, photoURL) at write time. This avoids N+1 reads when rendering a list of posts — no secondary fetch needed to display author info.

### Post types

Three types:
- `text`: any member can create
- `image`: any member can create (content field holds image URL)
- `announcement`: only community admins/owners can create (enforced in Firestore rules)

### Daily rate limiting

`getCountFromServer()` counts the user's posts for today before allowing a new one (max 5 posts per user per community per day). This is a server-side count, not client-side, to prevent bypassing.

### Soft-delete with `isDeleted` flag

Posts are soft-deleted (`isDeleted: true`). Queries filter with `where('isDeleted', '==', false)`. The `deletedBy` field records who performed the deletion (author self-delete vs. admin deletion).

### Cursor-based pagination

`startAfter(lastDoc)` pagination with `orderBy('createdAt', 'desc')`. The caller stores `lastDoc` and passes it for the next page load.

### Likes

`likesCount` is a numeric field on the post doc (incremented/decremented atomically). The actual like toggle is stored in a `posts/{postId}/likes/{uid}` subcollection for per-user idempotency.

## Consequences

- **Positive:** Polling is cheaper than `onSnapshot` for feeds that change infrequently.
- **Positive:** Denormalized author avoids N+1 reads.
- **Positive:** Server-side count for rate limiting is cheat-resistant.
- **Trade-off:** Announcements are not delivered in real time to members — they see them on next refresh or tab focus.
- **Trade-off:** `isDeleted` queries require a composite index (`isDeleted ASC + createdAt DESC`).

## Key Files

| File | Purpose |
|------|---------|
| `src/services/communityFeedService.ts` | CRUD for posts + soft-delete |
| `src/components/tabs/CommunityFeedTab.tsx` | Feed UI with pagination |
| `src/types/community.ts` | `CommunityPost`, `PostType` |
| `firestore.indexes.json` | `posts: isDeleted + createdAt`, `posts: type + isDeleted + createdAt` |
| `firestore.rules` | Announcement type restricted to community admins |

## Open Issues

- Post comments: `commentCount` field exists but no comment subcollection, CRUD, or UI. Define schema before building.
- No real-time announcement delivery — consider an `onSnapshot` listener just for `type == 'announcement'` posts to push to members.
- Image posts: content field holds URL but no image upload UI — admins must paste URLs.
