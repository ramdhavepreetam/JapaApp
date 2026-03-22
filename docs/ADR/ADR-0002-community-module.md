# ADR-0002: Community Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Communities

---

## Context

JapaApp allows users to create and join spiritual communities for collective chanting. Communities need: a roster of members with roles, aggregate japa statistics, real-time chat, a post feed, community-scoped pledges, and privacy controls (public/private/invite-only).

## Decision

### Flat root collection for memberships

`community_members/{communityId}_{uid}` is a **root collection** (not a subcollection of `communities`). This enables:
- Efficient query: `where('uid', '==', myUid)` to fetch all my communities in one read
- Efficient query: `where('communityId', '==', id)` to list members
- No Collection Group queries needed (which require index configuration and have limits)

### Subcollections for community content

`japa_entries`, `chat_messages`, and `posts` are subcollections of `communities/{communityId}`. This provides:
- Natural scoping — each community's data is isolated
- Security rules can check `isCommunityMember(communityId)` cleanly

### Transaction-based aggregation

When a japa entry is submitted (`communityJapaApi.submitJapaEntry`), a Firestore transaction atomically:
1. Creates the subcollection entry doc
2. Increments `communities/{id}.totalMalas` + `totalMantras`
3. Increments `community_members/{id}_{uid}.totalMalas` + `totalMantras`
4. Updates `users/{uid}.stats` (with streak recalculation)

All reads must come first in the transaction (Firestore requirement).

### Invite codes

Private communities use a 10-character cryptographically random invite code (`crypto.getRandomValues`). The code is stored on the community doc and rotated on demand.

### Feature toggles (chatEnabled, feedEnabled, counterEnabled)

Defined in the `Community` type but **not enforced in Firestore rules or UI routing** — the UI always shows all tabs. These are reserved for a future premium tier.

## Consequences

- **Positive:** Flat membership collection enables efficient "my communities" queries.
- **Positive:** Atomic transactions ensure community stats are always consistent.
- **Positive:** Subcollection isolation keeps security rules clean.
- **Trade-off:** `communityId` must be denormalized into membership docs to support queries.
- **Trade-off:** Batch deletion of a community requires explicit deletion of all subcollection docs (handled in `adminService.deleteCommunity`).

## Key Files

| File | Purpose |
|------|---------|
| `src/services/communityService.ts` | Full community CRUD + member management (604 LOC) |
| `src/services/communityJapaService.ts` | Japa entry transaction + recent entries |
| `src/services/communityChatService.ts` | Real-time chat via `onSnapshot` |
| `src/services/communityFeedService.ts` | Posts/announcements with daily rate limiting |
| `src/components/pages/CommunityHomePage.tsx` | Tabbed community view |
| `src/components/tabs/` | CommunityCounterTab, CommunityChatTab, CommunityFeedTab, CommunityMembersTab, CommunitySettingsTab, CommunityPledgesTab |
| `src/types/community.ts` | All community types |
| `firestore.rules` | `isCommunityMember`, `isCommunityAdmin`, `isCommunityOwner` helpers |

## Open Issues

- Feature toggles (chatEnabled, feedEnabled, counterEnabled) are defined but not persisted — enforce once premium tier is built.
- Post comments are counted (`commentCount` field) but there is no comment subcollection or CRUD yet.
- Real-time feed updates use polling (30s interval) instead of `onSnapshot` — consider upgrading for live announcements.
