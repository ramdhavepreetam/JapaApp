# ADR-0005: Admin Module Architecture

**Date:** 2026-03-21
**Status:** Accepted
**Module:** Admin Panel & Moderation

---

## Context

JapaApp needs super admin capabilities: banning users, assigning roles, featuring communities, deleting inappropriate content, and managing the mantra library. The admin panel must be inaccessible to regular users and all actions must be audit-logged.

## Decision

### Client SDK + Firestore rules (not Admin SDK)

Admin operations are performed from the client using the Firebase Client SDK. The `isAppAdmin()` Firestore security rule function gates all privileged operations by checking `users/{uid}.role in ['superadmin', 'admin']`. This avoids the complexity of deploying and maintaining a dedicated backend service.

> **Known limitation:** This means a compromised client with a forged admin role claim could theoretically bypass rules. True Admin SDK isolation would require Cloud Functions for all admin operations. This is an accepted risk for the current app size.

### Lazy-loaded, role-gated admin panel

`AdminPanel` is a lazy-loaded React chunk that only renders when `authUser.role === 'superadmin'`. Regular users never download the admin bundle. The route is `/admin` in `App.tsx`.

### Audit logging for all admin actions

Every admin operation writes to `admin_logs/{logId}`:
```
{ action, targetId, adminId, reason, createdAt }
```
`AdminAction` type lists all valid actions: `BAN_USER`, `UNBAN_USER`, `DELETE_COMMUNITY`, `FEATURE_COMMUNITY`, `UNFEATURE_COMMUNITY`, `ASSIGN_ROLE`, `DELETE_PLEDGE`.

Admin logs are immutable (`allow update, delete: if false`). Only admins can read them.

### Superadmin bootstrapping

The first superadmin is set manually in Firebase Console (direct Firestore write or Cloud Function invocation). There is no self-promotion code path — this is intentional to prevent privilege escalation.

### Admin tabs

| Tab | Capability |
|-----|-----------|
| Users | List users, search, ban/unban, assign roles |
| Communities | List, feature/unfeature, delete |
| Pledges | List all pledges (global + community), delete with reason |
| Stats | Global app metrics |
| Donations | Payment records |
| Mantras | Add/delete mantra library entries |

## Consequences

- **Positive:** No backend infrastructure needed for admin ops — fast to build and deploy.
- **Positive:** Audit log is immutable and admin-only — full audit trail.
- **Positive:** Lazy loading keeps admin bundle out of regular user downloads.
- **Trade-off:** Client SDK means Firestore rules must be airtight — any rule gap is a security hole.
- **Trade-off:** Admin operations are not atomic with audit log writes (two separate writes) — if the app crashes between them, the log may be missing. Mitigated by using `writeBatch` where possible.

## Key Files

| File | Purpose |
|------|---------|
| `src/admin/AdminPanel.tsx` | Main admin shell with tab navigation |
| `src/admin/AdminUsersTab.tsx` | User moderation |
| `src/admin/AdminCommunitiesTab.tsx` | Community moderation |
| `src/admin/AdminPledgesTab.tsx` | Pledge deletion with audit log |
| `src/admin/AdminMantrasTab.tsx` | Mantra library management |
| `src/admin/AdminStatsTab.tsx` | Global app stats |
| `src/admin/AdminDonationsTab.tsx` | Payment tracking |
| `src/services/adminService.ts` | All admin service methods |
| `src/types/admin.ts` | `AdminAction`, `AdminLog`, `AdminUserView`, `AdminCommunityView` |
| `firestore.rules` | `isAppAdmin()` helper + admin collection rules |

## Open Issues

- True privilege separation would require moving admin writes to Cloud Functions using the Firebase Admin SDK — this is a future hardening task.
- `adminService.deleteCommunity()` deletes the community doc but not its subcollections (japa_entries, chat_messages, posts) — these become orphaned. Needs a Cloud Function or recursive batch delete.
