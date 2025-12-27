import { db } from '../lib/firebase';
import {
    collection, doc, getDocs, updateDoc,
    query, where, orderBy, limit, Timestamp,
    writeBatch
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
     * Create Announcement with Client-Side Fan-out
     * (Warning: Only suitable for small communities < 500-1000 members in this client-side phase)
     */
    createAnnouncementNotificationsFanout: async (
        communityId: string,
        postId: string,
        title: string,
        body: string
    ): Promise<void> => {
        // 1. Fetch all active members
        // Ideally chunk this if we expect > 1000 members
        const membersQ = query(
            collection(db, 'community_members'),
            where('communityId', '==', communityId),
            where('status', '==', 'active')
        );

        const membersSnap = await getDocs(membersQ);

        // 2. Batch Writes
        const MAX_BATCH_SIZE = 450; // Safety margin under 500
        const chunks = [];
        const docs = membersSnap.docs;

        for (let i = 0; i < docs.length; i += MAX_BATCH_SIZE) {
            chunks.push(docs.slice(i, i + MAX_BATCH_SIZE));
        }

        for (const chunk of chunks) {
            const batch = writeBatch(db);

            chunk.forEach(memberDoc => {
                const member = memberDoc.data();
                const notifRef = doc(collection(db, 'users', member.uid, 'notifications'));

                const notification: Notification = {
                    id: notifRef.id,
                    type: 'announcement',
                    title: title,
                    body: body,
                    link: `/community/${communityId}/post/${postId}`,
                    read: false,
                    createdAt: Timestamp.now(), // Use local time for batch consistency or specific logic
                    data: { communityId, postId }
                };

                batch.set(notifRef, notification);
            });

            await batch.commit();
        }
    }
};
