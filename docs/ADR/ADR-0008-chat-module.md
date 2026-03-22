# ADR-0008: Chat Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Community Chat

---

## Context

Communities need real-time messaging for members to communicate during collective chanting sessions and general discussion. Messages must support replies, likes, moderation (soft-delete), and offline queuing.

## Decision

### Real-time via `onSnapshot`

`communityChatService.subscribeToChat()` uses Firestore's `onSnapshot` listener to deliver messages in real time. The listener fetches the newest 50 messages ordered by `createdAt DESC`. Older messages are loaded on demand via `loadMoreMessages()` (cursor-based pagination using `startAfter`).

### Soft-delete only

Messages are never hard-deleted. Deletion sets `isDeleted: true` and clears `content`. The UI renders "Deleted message" placeholder. This preserves conversation threads for context and provides a moderation audit trail.

### Client-side deduplication with `clientId`

Each message sent has a `clientId` (UUID generated client-side before sending). This enables:
- Optimistic UI: message appears instantly with a temporary ID
- Deduplication: if a retry is attempted (e.g., network hiccup), the server can detect the duplicate `clientId`
- Real `messageId` is backfilled once Firestore responds

### Offline queue

If the device is offline, messages are queued in `localStore.queueChatMessage()`. `syncService.syncChatMessages()` retries on reconnect. Queued messages are shown in the UI immediately (optimistic), with a "pending" indicator.

### Rate limiting

Client-side rate limiting: minimum 3 seconds between messages. Maximum message length: 500 characters. Both enforced in `communityChatService.sendMessage()`.

### Reply threading

`replyToId?: string` field supports reply-to-message threading. The UI renders the quoted message above the reply. Deep threading (reply-to-reply trees) is not supported — only one level.

## Consequences

- **Positive:** Real-time delivery via `onSnapshot` with no polling overhead.
- **Positive:** Soft-delete preserves thread context and provides moderation trail.
- **Positive:** `clientId` dedup prevents duplicate messages on retry.
- **Trade-off:** `onSnapshot` costs 1 read per message change — high-traffic communities will accumulate Firestore read costs.
- **Trade-off:** Offline queue is stored in localStorage per device — messages queued on device A won't be visible on device B until synced.

## Key Files

| File | Purpose |
|------|---------|
| `src/services/communityChatService.ts` | Subscribe, send, delete, load more |
| `src/components/tabs/CommunityChatTab.tsx` | Chat UI with optimistic updates |
| `src/services/localStore.ts` | `queueChatMessage()`, `getChatQueue()` |
| `src/services/syncService.ts` | `syncChatMessages()` on reconnect |
| `src/types/community.ts` | `ChatMessage` interface |
| `firestore.rules` | Chat subcollection: member-only read/create, soft-delete allowed |

## Open Issues

- No emoji reactions — `likes` field is an array of UIDs (binary liked/not-liked). Full emoji reactions would require a different schema.
- No push notifications for new chat messages — notifications collection exists but no server-side trigger writes to it.
- High-traffic communities may need Firestore message count limits or archive strategy.
