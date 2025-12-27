import { db } from '../lib/firebase';
import {
    doc, runTransaction, serverTimestamp, increment,
    collection, query, where, orderBy, limit, getDocs
} from 'firebase/firestore';
import { JapaEntry } from '../types/community';
import { runWithFallback } from './resilience';
import { localStore } from './localStore';

// Raw Firebase Implementation (Exported for SyncService)
export const communityJapaApi = {
    submitJapaEntry: async (communityId: string, entry: JapaEntry): Promise<void> => {
        const entryRef = doc(db, 'japa_entries', entry.id);
        const communityRef = doc(db, 'communities', communityId);
        const memberRef = doc(db, 'community_members', `${communityId}_${entry.userId}`);
        const userRef = doc(db, 'users', entry.userId);

        await runTransaction(db, async (transaction) => {
            // 1. Idempotency Check
            const entrySnap = await transaction.get(entryRef);
            if (entrySnap.exists()) {
                console.log("Japa Entry already processed (Idempotent).");
                return;
            }

            // 2. Create Entry
            transaction.set(entryRef, {
                ...entry,
                timestamp: serverTimestamp()
            });

            // 3. Update Community Totals
            transaction.update(communityRef, {
                totalMalas: increment(entry.malas),
                totalMantras: increment(entry.mantras)
            });

            // 4. Update Member Totals
            // Allowed to fail if not member, but assuming consistent state
            transaction.update(memberRef, {
                totalMalas: increment(entry.malas),
                totalMantras: increment(entry.mantras)
            });

            // 5. Update User Global Stats
            transaction.update(userRef, {
                'stats.totalMalas': increment(entry.malas),
                'stats.totalMantras': increment(entry.mantras),
                'stats.lastChantDate': new Date().toISOString().split('T')[0]
            });
        });
    }
};

export const communityJapaService = {

    /**
     * Submit a Japa Entry with Idempotency and Aggregation
     */
    submitJapaEntry: async (communityId: string, entry: JapaEntry): Promise<void> => {
        return runWithFallback(
            () => communityJapaApi.submitJapaEntry(communityId, entry),
            async () => {
                // Mock/Offline fallback
                // 1. Queue it
                localStore.queueJapaEntry(entry);
                // 2. Return success (optimistic)
            },
            "Submit Japa Entry"
        );
    },

    getRecentEntries: async (communityId: string, limitCount: number = 10): Promise<JapaEntry[]> => {
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'japa_entries'),
                    where('communityId', '==', communityId),
                    orderBy('timestamp', 'desc'),
                    limit(limitCount)
                );
                const snapshot = await getDocs(q);
                return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JapaEntry));
            },
            async () => {
                // Offline fallback - return queued items for this community?? 
                // Or just empty. Realistically we might want to see our queued items.
                const queue = localStore.getJapaQueue();
                return queue.filter(q => q.communityId === communityId)
                    .sort((a, b) => b.timestamp.seconds - a.timestamp.seconds)
                    .slice(0, limitCount);
            },
            "Get Recent Entries"
        );
    }
};
