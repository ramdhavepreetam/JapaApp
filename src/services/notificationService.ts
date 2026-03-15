import { db } from '../lib/firebase';
import {
    collection, doc, getDocs, updateDoc,
    query, where, orderBy, limit, Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { Notification } from '../types/community';

export const notificationService = {

    /**
     * List user notifications
     */
    listNotifications: async (uid: string, limitCount: number = 20): Promise<Notification[]> => {
        const q = query(
            collection(db, 'users', uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
    },

    /**
     * Mark notification as read
     */
    markRead: async (uid: string, notificationId: string): Promise<void> => {
        const ref = doc(db, 'users', uid, 'notifications', notificationId);
        await updateDoc(ref, { read: true });
    },

    /**
     * List Announcements (Pull-based) from communities
     */
    listAnnouncements: async (communityIds: string[], limitCount: number = 20): Promise<Notification[]> => {
        if (communityIds.length === 0) return [];

        // Note: 'in' query supports up to 10 items. If user has > 10 communities, 
        // we might need multiple queries or client-side filtering. 
        // For MVP Spark Plan, we'll assume < 10 or take top 10.
        const safeCommunityIds = communityIds.slice(0, 10);

        // We are querying collection groups or iterating?
        // Actually, the plan says: /communities/{communityId}/posts/{postId} where type='announcement'
        // To get a unified "Inbox", we need a Collection Group Query OR multiple queries.
        // Collection Group 'posts' index on type + createdAt needed.
        // Let's assume for now we iterate specific communities or use a Collection Group query 
        // if we index 'posts' by type 'announcement'.

        // Strategy A: Iterate and merge (Safe, Cheaper if few communities)
        // Strategy B: Collection Group (requires index, might read too much active data if not careful)

        // Given constraints and "Spark-only", Collection Group Queries count as reads.
        // Let's optimize for "My Communities".

        // For simplicity and rule security, we'll fetch from specific communities.
        // But doing N queries is bad.
        // Suggestion from Plan: "Aggregates announcements from user’s communities".

        const promises = safeCommunityIds.map(cid => {
            const q = query(
                collection(db, 'communities', cid, 'posts'),
                where('type', '==', 'announcement'),
                where('isDeleted', '==', false),
                orderBy('createdAt', 'desc'),
                limit(5) // Fetch top 5 from each
            );
            return getDocs(q);
        });

        const snapshots = await Promise.all(promises);
        let allAnnouncements: Notification[] = [];

        snapshots.forEach((snap, idx) => {
            const cid = safeCommunityIds[idx];
            snap.docs.forEach(d => {
                const data = d.data();
                allAnnouncements.push({
                    id: d.id,
                    type: 'announcement',
                    title: "Announcement from " + cid, // Title might be needed or derived
                    body: data.content,
                    link: `/community/${cid}`,
                    read: false, // Calculated/hydrated at display time usually
                    createdAt: data.createdAt,
                    data: { communityId: cid, postId: d.id, ...data }
                });
            });
        });

        // Sort combined results
        return allAnnouncements.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, limitCount);
    },

    /**
     * Mark Announcements Read for a Community
     */
    markAnnouncementsRead: async (communityId: string, uid: string): Promise<void> => {
        const memberRef = doc(db, 'community_members', `${communityId}_${uid}`);
        await updateDoc(memberRef, {
            lastReadAnnouncementsAt: serverTimestamp()
        });
    },

    /**
     * Get the latest announcement timestamp for a community (for badge check)
     */
    getLatestAnnouncementTime: async (communityId: string): Promise<Timestamp | null> => {
        const q = query(
            collection(db, 'communities', communityId, 'posts'),
            where('type', '==', 'announcement'),
            where('isDeleted', '==', false),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data().createdAt as Timestamp;
    }
};
