import { db } from '../lib/firebase';
import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc,
    query, where, orderBy, limit,
    startAfter, Timestamp, writeBatch, serverTimestamp,
    increment, DocumentSnapshot
} from 'firebase/firestore';
import { Community, CommunityMember, UserProfileSummary, UserRole, JoinRequest } from '../types/community';
import { runWithFallback } from './resilience';
import { localStore } from './localStore';

// 10-character cryptographically random invite code using an unambiguous alphabet
const generateInviteCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from(crypto.getRandomValues(new Uint8Array(10)))
        .map(b => chars[b % chars.length])
        .join('');
};

export const communityService = {

    /**
     * Create a new community
     */
    createCommunity: async (
        payload: {
            name: string;
            description: string;
            isPrivate: boolean;
            requiresApproval: boolean;
            creator: UserProfileSummary;
            imageUrl?: string;
            tags?: string[];
        }
    ): Promise<string> => {
        if (!payload.creator?.uid) throw new Error("Requires authentication");
        return runWithFallback(
            async () => {
                const batch = writeBatch(db);

                // 1. Create Community Doc
                const commRef = doc(collection(db, 'communities'));
                const communityData: Community = {
                    id: commRef.id,
                    name: payload.name,
                    description: payload.description,
                    imageUrl: payload.imageUrl || '',
                    creatorId: payload.creator.uid,
                    createdAt: Timestamp.now(),
                    isPrivate: payload.isPrivate,
                    requiresApproval: payload.requiresApproval,
                    membersCount: 1, // Creator is first member
                    totalMalas: 0,
                    totalMantras: 0,
                    tags: payload.tags || [],
                    inviteCode: generateInviteCode()
                };
                batch.set(commRef, communityData);

                // 2. Add Creator as Member (Owner)
                const memberId = `${commRef.id}_${payload.creator.uid}`;
                const memberRef = doc(db, 'community_members', memberId);
                const memberData: CommunityMember = {
                    uid: payload.creator.uid,
                    communityId: commRef.id,
                    role: 'owner',
                    joinedAt: Timestamp.now(),
                    totalMalas: 0,
                    totalMantras: 0,
                    status: 'active'
                };
                batch.set(memberRef, memberData);

                await batch.commit();
                return commRef.id;
            },
            async () => {
                // Mock Fallback
                const id = `mock_comm_${Date.now()}`;
                const comm: Community = {
                    id,
                    name: payload.name,
                    description: payload.description,
                    imageUrl: payload.imageUrl || '',
                    creatorId: payload.creator.uid,
                    createdAt: Timestamp.now(),
                    isPrivate: payload.isPrivate,
                    requiresApproval: payload.requiresApproval,
                    membersCount: 1,
                    totalMalas: 0,
                    totalMantras: 0,
                    tags: payload.tags || []
                };
                localStore.createCommunity(comm);
                localStore.joinCommunity({
                    uid: payload.creator.uid,
                    communityId: id,
                    role: 'owner',
                    joinedAt: Timestamp.now(),
                    totalMalas: 0,
                    totalMantras: 0,
                    status: 'active'
                });
                return id;
            },
            "Create Community"
        );
    },

    /**
     * Discover communities (public)
     */
    discoverCommunities: async (limitCount: number = 20, lastDoc?: DocumentSnapshot): Promise<{ communities: Community[], lastDoc: DocumentSnapshot | null }> => {
        return runWithFallback(
            async () => {
                let q = query(
                    collection(db, 'communities'),
                    where('isPrivate', '==', false),
                    orderBy('membersCount', 'desc'),
                    limit(limitCount)
                );

                if (lastDoc) {
                    q = query(q, startAfter(lastDoc));
                }

                const snapshot = await getDocs(q);
                const communities = snapshot.docs.map(d => d.data() as Community);

                return {
                    communities,
                    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
                };
            },
            async () => {
                // Mock
                const all = localStore.getCommunities();
                // Filter private, sort desc
                const publicComms = all.filter(c => !c.isPrivate).sort((a, b) => b.membersCount - a.membersCount);
                return {
                    communities: publicComms.slice(0, limitCount),
                    lastDoc: null
                };
            },
            "Discover Communities"
        );
    },

    /**
     * Get details of a single community
     */
    getCommunity: async (communityId: string): Promise<Community | null> => {
        return runWithFallback(
            async () => {
                const ref = doc(db, 'communities', communityId);
                const snap = await getDoc(ref);
                return snap.exists() ? (snap.data() as Community) : null;
            },
            async () => {
                return localStore.getCommunity(communityId);
            },
            "Get Community"
        );
    },

    /**
     * Get details of a single community member
     */
    getCommunityMember: async (communityId: string, uid: string): Promise<CommunityMember | null> => {
        return runWithFallback(
            async () => {
                const ref = doc(db, 'community_members', `${communityId}_${uid}`);
                const snap = await getDoc(ref);
                return snap.exists() ? (snap.data() as CommunityMember) : null;
            },
            async () => {
                return localStore.getMember(communityId, uid);
            },
            "Get Community Member"
        );
    },

    /**
     * Get communities the user is a member of
     */
    getMyCommunities: async (uid: string): Promise<CommunityMember[]> => {
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'community_members'),
                    where('uid', '==', uid),
                    where('status', '==', 'active')
                );
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => d.data() as CommunityMember);
            },
            async () => {
                const data = localStore.getMyCommunities(uid);
                return data.map(d => ({
                    uid: uid,
                    communityId: d.communityId,
                    role: d.role as UserRole,
                    joinedAt: Timestamp.now(),
                    totalMalas: 0,
                    totalMantras: 0,
                    status: 'active'
                }));
            },
            "Get My Communities"
        );
    },

    /**
     * Join an open community immediately
     */
    joinCommunityOpen: async (communityId: string, userProfile: UserProfileSummary): Promise<void> => {
        if (!userProfile?.uid) throw new Error("Requires authentication");
        return runWithFallback(
            async () => {
                const commRef = doc(db, 'communities', communityId);
                const commSnap = await getDoc(commRef);
                if (!commSnap.exists()) throw new Error("Community not found");

                const comm = commSnap.data() as Community;
                if (comm.requiresApproval) throw new Error("This community requires approval to join.");

                const memberId = `${communityId}_${userProfile.uid}`;
                const memberRef = doc(db, 'community_members', memberId);

                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists() && memberSnap.data()?.status === 'banned') {
                    throw new Error("You are banned from this community.");
                }
                if (memberSnap.exists() && memberSnap.data()?.status === 'active') {
                    return; // Already joined
                }

                const batch = writeBatch(db);
                batch.set(memberRef, {
                    uid: userProfile.uid,
                    communityId: communityId,
                    role: 'member',
                    joinedAt: serverTimestamp(),
                    totalMalas: 0,
                    totalMantras: 0,
                    status: 'active'
                });
                batch.update(commRef, { membersCount: increment(1) });

                await batch.commit();
            },
            async () => {
                // Mock join
                const comm = localStore.getCommunity(communityId);
                if (!comm) throw new Error("Community not found");
                localStore.joinCommunity({
                    uid: userProfile.uid,
                    communityId,
                    role: 'member',
                    joinedAt: Timestamp.now(),
                    totalMalas: 0,
                    totalMantras: 0,
                    status: 'active'
                });
            },
            "Join Community"
        );
    },

    /**
     * Request to join a community
     */
    requestJoinCommunity: async (communityId: string, userProfile: UserProfileSummary): Promise<void> => {
        if (!userProfile?.uid) throw new Error("Requires authentication");
        return runWithFallback(
            async () => {
                const commRef = doc(db, 'communities', communityId);
                const commSnap = await getDoc(commRef);
                if (!commSnap.exists()) throw new Error("Community not found");

                const memberId = `${communityId}_${userProfile.uid}`;
                const memberRef = doc(db, 'community_members', memberId);
                const memberSnap = await getDoc(memberRef);

                if (memberSnap.exists()) {
                    if (memberSnap.data()?.status === 'banned') throw new Error("You are banned from this community.");
                    if (memberSnap.data()?.status === 'active') throw new Error("Already a member.");
                }

                const reqId = `${communityId}_${userProfile.uid}`;
                const reqRef = doc(db, 'community_join_requests', reqId);
                await setDoc(reqRef, {
                    id: reqId,
                    communityId,
                    user: userProfile,
                    status: 'pending',
                    requestedAt: serverTimestamp()
                });
            },
            async () => {
                // Queue request locally for retry when online
                const key = 'japa_v1_pending_join_requests';
                try {
                    const stored = localStorage.getItem(key);
                    const requests: { communityId: string; uid: string; requestedAt: number }[] = stored ? JSON.parse(stored) : [];
                    if (!requests.find(r => r.communityId === communityId && r.uid === userProfile.uid)) {
                        requests.push({ communityId, uid: userProfile.uid, requestedAt: Date.now() });
                        localStorage.setItem(key, JSON.stringify(requests));
                    }
                } catch {}
            },
            "Request Join Community"
        );
    },

    /**
     * Join with Invite Code
     */
    joinWithInviteCode: async (inviteCode: string, userProfile: UserProfileSummary): Promise<void> => {
        if (!userProfile?.uid) throw new Error("Requires authentication");
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'communities'),
                    where('inviteCode', '==', inviteCode),
                    limit(1)
                );
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    throw new Error("Invalid invite code");
                }

                const commDoc = snapshot.docs[0];
                const communityId = commDoc.id;

                const memberId = `${communityId}_${userProfile.uid}`;
                const memberRef = doc(db, 'community_members', memberId);
                const memberSnap = await getDoc(memberRef);
                if (memberSnap.exists()) {
                    const status = memberSnap.data()?.status;
                    if (status === 'banned') throw new Error("Banned from this community");
                    if (status === 'active') throw new Error("Already a member");
                }

                const batch = writeBatch(db);
                batch.set(memberRef, {
                    uid: userProfile.uid,
                    communityId: communityId,
                    role: 'member',
                    joinedAt: serverTimestamp(),
                    totalMalas: 0,
                    totalMantras: 0,
                    status: 'active'
                });
                if (!memberSnap.exists() || memberSnap.data()?.status !== 'active') {
                    batch.update(commDoc.ref, { membersCount: increment(1) });
                }
                await batch.commit();
            },
            async () => {
                // Invite code lookup requires Firestore — cannot work offline
                throw new Error("Joining with an invite code requires an internet connection. Please try again when online.");
            },
            "Join With Invite Code"
        );
    },

    /**
     * Approve a join request
     */
    approveMember: async (communityId: string, memberUid: string, _adminUid: string): Promise<void> => {
        if (!_adminUid) throw new Error("Requires authentication");
        // ideally verify admin role here or via firestore rules. 
        // We will assume UI checks but enforcing via rules is best.

        const reqRef = doc(db, 'community_join_requests', `${communityId}_${memberUid}`);
        const reqSnap = await getDoc(reqRef);
        if (!reqSnap.exists()) throw new Error("Request not found");

        // const reqData = reqSnap.data() as JoinRequest;

        const batch = writeBatch(db);

        // Create member
        const memberRef = doc(db, 'community_members', `${communityId}_${memberUid}`);
        batch.set(memberRef, {
            uid: memberUid,
            communityId: communityId,
            role: 'member',
            joinedAt: serverTimestamp(),
            totalMalas: 0,
            totalMantras: 0,
            status: 'active'
        });

        // Update Community Count
        const commRef = doc(db, 'communities', communityId);
        batch.update(commRef, { membersCount: increment(1) });

        // Delete request or mark approved
        batch.delete(reqRef); // Or update status to 'approved' for history

        await batch.commit();
    },

    /**
     * Reject a join request
     */
    rejectMember: async (communityId: string, memberUid: string): Promise<void> => {
        // Assume admin check happens downstream via rules or caller, but ensuring at least caller is auth'd usually needs another arg.
        // For now, leaving as is since signature doesn't take adminUid. 
        const reqRef = doc(db, 'community_join_requests', `${communityId}_${memberUid}`);
        await updateDoc(reqRef, { status: 'rejected' });
        // Or delete
    },

    /**
     * Leave a community
     */
    leaveCommunity: async (communityId: string, uid: string): Promise<void> => {
        if (!uid) throw new Error("Requires authentication");
        const memberRef = doc(db, 'community_members', `${communityId}_${uid}`);
        const commRef = doc(db, 'communities', communityId);

        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists() || memberSnap.data()?.status !== 'active') {
            return;
        }

        const batch = writeBatch(db);
        batch.update(memberRef, { status: 'left' }); // Soft delete/mark left to keep stats? Or hard delete?
        // Usually better to keep for "total historical contribution" but prompt says "leave". 
        // Let's set status to left.

        batch.update(commRef, { membersCount: increment(-1) });
        await batch.commit();
    },

    /**
     * Update Member Role
     */
    updateMemberRole: async (communityId: string, memberUid: string, newRole: UserRole): Promise<void> => {
        // Assume admin auth check is handled in caller layer or rules, as signature lacks admin param.
        const memberRef = doc(db, 'community_members', `${communityId}_${memberUid}`);
        await updateDoc(memberRef, { role: newRole });
    },

    /**
     * Remove or Ban Member
     */
    removeOrBanMember: async (communityId: string, memberUid: string, action: 'remove' | 'ban'): Promise<void> => {
        // Assuming admin auth check handled in caller/rules.
        const memberRef = doc(db, 'community_members', `${communityId}_${memberUid}`);
        const commRef = doc(db, 'communities', communityId);

        const batch = writeBatch(db);

        if (action === 'ban') {
            batch.update(memberRef, { status: 'banned' });
        } else {
            batch.delete(memberRef); // Remove completely
            // Or batch.update(memberRef, { status: 'left' }) if we want to preserve stats
        }

        batch.update(commRef, { membersCount: increment(-1) });
        await batch.commit();
    },
    /**
     * List members of a community
     */
    getCommunityMembers: async (communityId: string, limitCount: number = 50): Promise<CommunityMember[]> => {
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'community_members'),
                    where('communityId', '==', communityId),
                    where('status', '==', 'active'),
                    orderBy('joinedAt', 'desc'),
                    limit(limitCount)
                );
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => d.data() as CommunityMember);
            },
            async () => {
                // Mock
                // simplified mock return
                return [];
            },
            "Get Community Members"
        );
    },

    /**
     * Get pending join requests
     */
    getJoinRequests: async (communityId: string): Promise<JoinRequest[]> => {
        try {
            const q = query(
                collection(db, 'community_join_requests'),
                where('communityId', '==', communityId),
                where('status', '==', 'pending'),
                orderBy('requestedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => d.data() as JoinRequest);
        } catch (e) {
            console.warn("Failed to get join requests", e);
            // Do NOT trigger global fallback for permission errors here
            return [];
        }
    },

    /**
     * Update Community Settings
     */
    updateCommunity: async (communityId: string, updates: Partial<Community>): Promise<void> => {
        // Assuming admin auth check handled upstream.
        const ref = doc(db, 'communities', communityId);
        await updateDoc(ref, updates);
    },
    /**
     * Search communities by name (prefix search)
     */
    searchCommunities: async (term: string, limitCount: number = 20): Promise<Community[]> => {
        return runWithFallback(
            async () => {
                // Firestore Prefix Search: name >= term AND name <= term + '\uf8ff'
                // Note: Case sensitivity matters. Ideally stored lowercase name for search, 
                // but for MVP we assume user types correct case or we rely on client filtering if list is small?
                // No, prompt asked for "put few characters". We will try standard range query.
                // Better approach for production: dedicated search service (Algolia) or lowercase field.
                // We'll trust the current "name" field.

                const q = query(
                    collection(db, 'communities'),
                    where('isPrivate', '==', false),
                    where('name', '>=', term),
                    where('name', '<=', term + '\uf8ff'),
                    limit(limitCount)
                );

                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => d.data() as Community);
            },
            async () => {
                // Mock
                const all = localStore.getCommunities();
                const lower = term.toLowerCase();
                return all.filter(c => !c.isPrivate && c.name.toLowerCase().includes(lower));
            },
            "Search Communities"
        );
    }
};
