# ADR-0003: Pledge/Cause Module Architecture

**Date:** 2026-03-21 (updated 2026-03-24)
**Status:** Accepted (Revised)
**Module:** Pledges / Spiritual Causes

---

## Context

Pledges ("spiritual causes") allow users to commit to chanting a target number of malas. The original design exposed a global public feed where any user could create pledges visible to everyone. This caused overwhelm and privacy issues — users' personal spiritual commitments were broadcast publicly.

## Decision (Revised 2026-03-24)

### Two pledge modes: Personal and Community

The pledge system is split into two distinct, separate modes:

1. **Personal pledges** — Stored in `users/{uid}/pledges/{pledgeId}` subcollection. Fully private to the creator. Only the creator can read, write, and contribute to them. Tracked separately from the community japa counter.

2. **Community pledges** — Stored in `pledges/{pledgeId}` root collection with required `communityId`. Visible to all community members. Only community admins/owners can create them.

The global public pledge browser is removed. The "Pledges" bottom nav now shows only your own pledges (personal + community ones you've joined).

### Personal pledges use user subcollection

Personal pledges live in `users/{uid}/pledges/{pledgeId}`. This choice:
- Enforces privacy structurally — Firestore rule `allow read, write: if isOwner(userId)` already existed
- Requires no `pledge_participants` records (single-user, contribution tracked directly on the pledge doc)
- Keeps admin scope clean — admins don't need to see personal pledges

### Community pledges remain in root collection

`pledges/{pledgeId}` root collection is kept for community pledges. This allows:
- Admin can query all community pledges globally with a single collection scan
- Community pledges filtered by `where('communityId', '==', id)` in `getCommunityPledges()`
- No schema migration required for existing community pledges

### Community pledges: admin/owner-only creation

Previously any authenticated user could create pledges. Now only community admins/owners can create community pledges (enforced in Firestore rules). This prevents pledge sprawl on the community shared board.

### Global pledges deprecated (not deleted)

Legacy pledges without `communityId` are left in Firestore (no migration) but are no longer surfaced in the UI. The Firestore read rule for the `pledges` collection changes from `if true` (public) to members-only (`isCommunityMember(communityId)`), with a backward-compat exception for pledges where `communityId == null`.

### Batch operations for atomicity (unchanged)

Community pledge writes continue to use `writeBatch` with `increment()`. Deletion is chunked into 499-operation batches. Personal pledge contributions use a simple `increment()` update (no batch needed — single-doc operation).

### Admin delete with audit log (unchanged)

Superadmins can delete any community pledge via `adminService.deletePledge()`. Community admins can delete pledges in their community.

## Consequences

- **Positive:** Personal pledges are private — no privacy concerns.
- **Positive:** Community pledge board stays focused — only admins create.
- **Positive:** Main pledges screen is personal and relevant — not a noisy global feed.
- **Positive:** No data migration — legacy global pledges left in Firestore, hidden in UI.
- **Trade-off:** `CommunityView.tsx` (global pledge browser) is deleted — not reusable.
- **Trade-off:** `personalPledgeService.ts` is a new service file with its own mock/real pattern.
- **Trade-off:** `CommunityContext.tsx` no longer subscribes to global pledges — any consumer of `pledges` from context must be updated.

## Key Files

| File | Purpose |
|------|---------|
| `src/types/pledge.ts` | `Pledge`, `PledgeParticipant`, `PersonalPledge` types |
| `src/services/pledgeService.ts` | Community pledge CRUD; `getCommunityPledges()` |
| `src/services/personalPledgeService.ts` | Personal pledge CRUD (new) |
| `src/services/adminService.ts` | Admin `getPledges()` + `deletePledge()` with audit log |
| `src/components/PledgesView.tsx` | Two-tab pledges screen (Personal + Community) — replaces `CommunityView.tsx` |
| `src/components/PledgeCard.tsx` | Pledge display card (supports `variant: 'personal' | 'community'`) |
| `src/components/PledgeForm.tsx` | Pledge creation/edit form (shared between personal and community) |
| `src/components/tabs/CommunityPledgesTab.tsx` | Community-scoped pledge board (inside community) |
| `src/admin/AdminPledgesTab.tsx` | Admin pledge management with delete |
| `firestore.indexes.json` | `pledges: communityId + participants` composite index |

## Open Issues

- Pledge milestones/badges (e.g., 25%, 50%, 100% completion) are not tracked.
- No leaderboard within a community pledge — `pledge_participants` data exists but no UI.
- `createdAt` field should be written in `pledgeService.createPledge()` — currently caller-supplied.
