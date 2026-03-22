# ADR-0003: Pledge/Cause Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Pledges / Spiritual Causes

---

## Context

Pledges ("spiritual causes") allow users to collectively commit to chanting a target number of malas. Originally designed as a global feature (any user can create and join any pledge), pledges are now being extended to support community-scoped causes.

## Decision

### Backward-compatible community extension

The `Pledge` type gains an optional `communityId?: string` field. Existing pledges without `communityId` remain global/legacy. New pledges created within a community context include `communityId`.

This avoids a schema migration. The system supports two modes simultaneously:
- **Global pledges** (`communityId` absent): visible to all users in the global pledge browser
- **Community pledges** (`communityId` present): visible only in the specific community's Pledges tab

### Root collection, not subcollection

Pledges remain in the root `pledges/{pledgeId}` collection (not under `communities/{id}/pledges`). This enables:
- Admin can query all pledges globally with a single collection scan
- Global pledge browser still works without Collection Group queries
- Community pledges are filtered by `where('communityId', '==', id)`

### Participant tracking in root collection

`pledge_participants/{pledgeId}_{userId}` is a root collection. This allows `where('userId', '==', uid)` to fetch all of a user's participations in one query.

### Batch operations for atomicity

All pledge writes use `writeBatch` with `increment()` to avoid race conditions when multiple users contribute simultaneously. Pledge deletion is chunked into 499-operation batches (Firestore limit: 500 ops/batch) to handle high-participation pledges.

### Admin delete with audit log

Super admins can delete any pledge via `adminService.deletePledge(pledgeId, reason)`. This:
1. Batch-deletes all `pledge_participants` for that pledge
2. Deletes the pledge doc itself
3. Writes a `DELETE_PLEDGE` entry to `admin_logs`

Community admins can delete community-scoped pledges they administer (enforced in Firestore rules).

## Consequences

- **Positive:** Fully backward compatible — no data migration needed.
- **Positive:** Single collection for admin oversight of all pledges.
- **Positive:** Community pledges are scoped without moving to subcollections.
- **Trade-off:** Must add composite Firestore index (`communityId ASC + participants DESC`) for community pledge queries.
- **Trade-off:** Global pledge browser and community pledge tabs query different fields — keep queries separate to avoid confusion.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/pledge.ts` | `Pledge` + `PledgeParticipant` types |
| `src/services/pledgeService.ts` | Full pledge CRUD; `getCommunityPledges()` for scoped queries |
| `src/services/adminService.ts` | `getPledges()` + `deletePledge()` with audit log |
| `src/components/PledgeCard.tsx` | Pledge display card |
| `src/components/PledgeForm.tsx` | Pledge creation form (dialog content) |
| `src/components/tabs/CommunityPledgesTab.tsx` | Community-scoped pledge browser |
| `src/components/CommunityView.tsx` | Global pledge browser |
| `src/admin/AdminPledgesTab.tsx` | Admin pledge management with delete |
| `firestore.indexes.json` | `pledges: communityId + participants` composite index |

## Open Issues

- Pledge milestones/badges (e.g., 25%, 50%, 100% completion) are not tracked — could add milestone notifications.
- No leaderboard within a pledge (top contributors) — `pledge_participants` data exists but no UI.
- `createdAt` field was added to `Pledge` type for admin sorting but needs to be written in `pledgeService.createPledge()` — currently only present if caller passes it.
