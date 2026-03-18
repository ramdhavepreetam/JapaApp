import { db } from '../lib/firebase';
import {
    doc, runTransaction, serverTimestamp, increment,
    collection, query, orderBy, limit, getDocs
} from 'firebase/firestore';
import { JapaEntry } from '../types/community';
import { runWithFallback } from './resilience';
import { localStore } from './localStore';
import { calculateStreak } from './streakUtils';
import { track } from '../lib/analytics';

// Raw Firebase Implementation (Exported for SyncService)
export const communityJapaApi = {
    submitJapaEntry: async (communityId: string, entry: JapaEntry): Promise<void> => {
        // BUG FIX #1: japa_entries is a SUBCOLLECTION under communities, not a root collection.
        // The Firestore rules define: match /communities/{communityId}/japa_entries/{entryId}
        // Writing to root collection caused permission-denied on every submit, silently
        // switching the entire app to offline/mock mode.
        const entryRef = doc(db, 'communities', communityId, 'japa_entries', entry.id);
        const communityRef = doc(db, 'communities', communityId);
        const memberRef = doc(db, 'community_members', `${communityId}_${entry.userId}`);
        const userRef = doc(db, 'users', entry.userId);

        await runTransaction(db, async (transaction) => {
            // 1. ALL Reads First (Firestore Rule)
            const entrySnap = await transaction.get(entryRef);
            if (entrySnap.exists()) {
                console.log("Japa Entry already processed (Idempotent).");
                return;
            }
            const userSnap = await transaction.get(userRef);
            const commSnap = await transaction.get(communityRef);
            const memberSnap = await transaction.get(memberRef);

            // 2. ALL Writes Second
            transaction.set(entryRef, {
                ...entry,
                timestamp: serverTimestamp()
            });

            // Update Community Totals if it exists
            if (commSnap.exists()) {
                transaction.update(communityRef, {
                    totalMalas: increment(entry.malas),
                    totalMantras: increment(entry.mantras)
                });
            }

            // Update Member Totals if it exists
            if (memberSnap.exists()) {
                transaction.update(memberRef, {
                    totalMalas: increment(entry.malas),
                    totalMantras: increment(entry.mantras)
                });
            }

            // Update User Global Stats
            // BUG FIX #2: transaction.update() fails with NOT_FOUND if the user doc
            // doesn't exist yet (new users). Use set+merge to handle both cases atomically.
            const today = new Date().toISOString().split('T')[0];
            let newStreak = 1;

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const currentStats = userData.stats || {};
                newStreak = calculateStreak(currentStats.lastChantDate || null, currentStats.streakDays || 0);
                // Existing user: safe to use update with increment
                transaction.update(userRef, {
                    'stats.totalMalas': increment(entry.malas),
                    'stats.totalMantras': increment(entry.mantras),
                    'stats.lastChantDate': today,
                    'stats.streakDays': newStreak
                });
            } else {
                // New user: doc doesn't exist yet — use set+merge to create it
                transaction.set(userRef, {
                    uid: entry.userId,
                    stats: {
                        totalMalas: entry.malas,
                        totalMantras: entry.mantras,
                        streakDays: 1,
                        lastChantDate: today
                    }
                }, { merge: true });
            }
        });
    }
};

export const communityJapaService = {

    /**
     * Submit a Japa Entry with Idempotency and Aggregation
     */
    submitJapaEntry: async (communityId: string, entry: JapaEntry): Promise<void> => {
        return runWithFallback(
            async () => {
                await communityJapaApi.submitJapaEntry(communityId, entry);
                track.japaCompleted(entry.malas);
            },
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
                // BUG FIX #1 (continued): query the subcollection, not root collection.
                // No need for where('communityId', ...) — the subcollection path scopes it.
                const q = query(
                    collection(db, 'communities', communityId, 'japa_entries'),
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
                    .sort((a, b) => b.queuedAt - a.queuedAt)
                    .slice(0, limitCount);
            },
            "Get Recent Entries"
        );
    }
};
