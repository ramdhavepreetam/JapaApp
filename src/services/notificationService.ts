import { db } from '../lib/firebase';
import {
    collection, doc, getDoc, getDocs, updateDoc,
    query, where, orderBy, limit, Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { Notification } from '../types/community';
import { runWithFallback } from './resilience';

export const notificationService = {

    listNotifications: async (uid: string, limitCount: number = 20): Promise<Notification[]> => {
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'users', uid, 'notifications'),
                    orderBy('createdAt', 'desc'),
                    limit(limitCount)
                );
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
            },
            async () => [],
            'List Notifications'
        );
    },

    markRead: async (uid: string, notificationId: string): Promise<void> => {
        return runWithFallback(
            async () => {
                const ref = doc(db, 'users', uid, 'notifications', notificationId);
                await updateDoc(ref, { read: true });
            },
            async () => {},
            'Mark Notification Read'
        );
    },

    listAnnouncements: async (communityIds: string[], limitCount: number = 20): Promise<Notification[]> => {
        if (communityIds.length === 0) return [];
        const safeCommunityIds = communityIds.slice(0, 10);

        return runWithFallback(
            async () => {
                const promises = safeCommunityIds.map(cid => {
                    const q = query(
                        collection(db, 'communities', cid, 'posts'),
                        where('type', '==', 'announcement'),
                        where('isDeleted', '==', false),
                        orderBy('createdAt', 'desc'),
                        limit(5)
                    );
                    return getDocs(q).then(snap => ({ snap, cid }));
                });

                const results = await Promise.all(promises);
                const allAnnouncements: Notification[] = [];

                results.forEach(({ snap, cid }) => {
                    snap.docs.forEach(d => {
                        const data = d.data();
                        allAnnouncements.push({
                            id: d.id,
                            type: 'announcement',
                            title: data.title || 'Community Announcement',
                            body: data.content,
                            link: `/community/${cid}`,
                            read: false,
                            createdAt: data.createdAt,
                            data: { communityId: cid, postId: d.id, ...data }
                        });
                    });
                });

                return allAnnouncements
                    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
                    .slice(0, limitCount);
            },
            async () => [],
            'List Announcements'
        );
    },

    markAnnouncementsRead: async (communityId: string, uid: string): Promise<void> => {
        return runWithFallback(
            async () => {
                const memberRef = doc(db, 'community_members', `${communityId}_${uid}`);
                await updateDoc(memberRef, { lastReadAnnouncementsAt: serverTimestamp() });
            },
            async () => {},
            'Mark Announcements Read'
        );
    },

    getLatestAnnouncementTime: async (communityId: string): Promise<Timestamp | null> => {
        return runWithFallback(
            async () => {
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
            },
            async () => null,
            'Get Latest Announcement Time'
        );
    },

    getUnreadCount: async (uid: string, communityIds: string[]): Promise<number> => {
        if (communityIds.length === 0) return 0;
        const safeCommunityIds = communityIds.slice(0, 10);

        return runWithFallback(
            async () => {
                const postPromises = safeCommunityIds.map(cid => {
                    const q = query(
                        collection(db, 'communities', cid, 'posts'),
                        where('type', '==', 'announcement'),
                        where('isDeleted', '==', false),
                        orderBy('createdAt', 'desc'),
                        limit(5)
                    );
                    return getDocs(q).then(snap => ({ snap, cid }));
                });

                const memberDocPromises = safeCommunityIds.map(cid =>
                    getDoc(doc(db, 'community_members', `${cid}_${uid}`)).then(snap => ({ snap, cid }))
                );

                const [postResults, memberResults] = await Promise.all([
                    Promise.all(postPromises),
                    Promise.all(memberDocPromises)
                ]);

                const lastReadMap: Record<string, number> = {};
                memberResults.forEach(({ snap, cid }) => {
                    if (snap.exists()) {
                        const t = snap.data().lastReadAnnouncementsAt;
                        lastReadMap[cid] = t ? t.toMillis() : 0;
                    }
                });

                let unread = 0;
                postResults.forEach(({ snap, cid }) => {
                    const lastRead = lastReadMap[cid] ?? 0;
                    snap.docs.forEach(d => {
                        const t = d.data().createdAt;
                        if (t && t.toMillis() > lastRead) unread++;
                    });
                });

                return unread;
            },
            async () => 0,
            'Get Unread Count'
        );
    }
};
