import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { calculateStreak } from './streakUtils';
import { runWithFallback } from './resilience';
import { storage, getTodayDate } from '../lib/storage';

export interface UserProfile {
    uid: string;
    displayName: string;
    photoURL: string;
    email: string;
    stats: {
        totalMalas: number;
        totalMantras: number;
        streakDays: number;
        lastChantDate: string | null; // ISO string YYYY-MM-DD
    };
    joinedAt: Timestamp;
}

// --- Local cache helpers ---
const USER_CACHE_KEY = (uid: string) => `japa_v1_user_${uid}`;

const getCachedProfile = (uid: string): UserProfile | null => {
    try {
        const s = localStorage.getItem(USER_CACHE_KEY(uid));
        return s ? JSON.parse(s) : null;
    } catch { return null; }
};

const setCachedProfile = (uid: string, profile: UserProfile) => {
    try { localStorage.setItem(USER_CACHE_KEY(uid), JSON.stringify(profile)); } catch {}
};

const makeEmptyProfile = (user: User): UserProfile => ({
    uid: user.uid,
    displayName: user.displayName || 'Sadhaka',
    photoURL: user.photoURL || '',
    email: user.email || '',
    stats: { totalMalas: 0, totalMantras: 0, streakDays: 0, lastChantDate: null },
    joinedAt: Timestamp.now()
});

export const userService = {
    // Ensure user document exists in Firestore on first login
    ensureUserExists: async (user: User) => {
        if (!user) return;
        return runWithFallback(
            async () => {
                const userRef = doc(db, 'users', user.uid);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    const newProfile = makeEmptyProfile(user);
                    await setDoc(userRef, newProfile, { merge: true });
                    setCachedProfile(user.uid, newProfile);
                    return newProfile;
                } else {
                    const profile = userSnap.data() as UserProfile;
                    setCachedProfile(user.uid, profile);
                    return profile;
                }
            },
            async () => {
                const cached = getCachedProfile(user.uid);
                if (cached) return cached;
                const profile = makeEmptyProfile(user);
                setCachedProfile(user.uid, profile);
                return profile;
            },
            "Ensure User Exists"
        );
    },

    // Optimized method for when we know the user is new
    createProfile: async (user: User): Promise<UserProfile> => {
        return runWithFallback(
            async () => {
                const userRef = doc(db, 'users', user.uid);
                const newProfile = makeEmptyProfile(user);
                await setDoc(userRef, newProfile, { merge: true });
                setCachedProfile(user.uid, newProfile);
                return newProfile;
            },
            async () => {
                const profile = makeEmptyProfile(user);
                setCachedProfile(user.uid, profile);
                return profile;
            },
            "Create Profile"
        );
    },

    getUserProfile: async (uid: string) => {
        return runWithFallback(
            async () => {
                const userRef = doc(db, 'users', uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const profile = userSnap.data() as UserProfile;
                    setCachedProfile(uid, profile);
                    return profile;
                }
                return null;
            },
            async () => getCachedProfile(uid),
            "Get User Profile"
        );
    },

    // Uses FieldValue.increment() for totalMalas/totalMantras to avoid race conditions
    updateUserStats: async (userId: string, malasCompleted: number = 0, countsCompleted: number = 0) => {
        if (malasCompleted <= 0 && countsCompleted <= 0) return;
        return runWithFallback(
            async () => {
                const userRef = doc(db, 'users', userId);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) return;

                const data = userSnap.data() as UserProfile;
                const currentStats = data.stats || {
                    totalMalas: 0, totalMantras: 0, streakDays: 0, lastChantDate: null
                };

                const resolvedCounts = countsCompleted > 0
                    ? countsCompleted
                    : Math.max(0, malasCompleted) * 108;

                const newStreak = calculateStreak(currentStats.lastChantDate, currentStats.streakDays || 0);
                // Use local calendar date (not UTC toISOString) so lastChantDate matches
                // the user's clock — prevents streak from breaking for IST users after 5:30 AM.
                const today = getTodayDate();

                // Use increment() for cumulative fields — atomic, safe for concurrent updates
                await updateDoc(userRef, {
                    'stats.totalMalas': increment(Math.max(0, malasCompleted)),
                    'stats.totalMantras': increment(Math.max(0, resolvedCounts)),
                    'stats.streakDays': newStreak,
                    'stats.lastChantDate': today
                });

                // Update local cache with best-guess values
                setCachedProfile(userId, {
                    ...data,
                    stats: {
                        totalMalas: (currentStats.totalMalas || 0) + Math.max(0, malasCompleted),
                        totalMantras: (currentStats.totalMantras || 0) + Math.max(0, resolvedCounts),
                        streakDays: newStreak,
                        lastChantDate: today
                    }
                });
            },
            async () => {
                // OFFLINE PATH: update local cache AND enqueue for Firestore sync on reconnect.
                // IMPORTANT: runWithFallback never rejects, so the caller's .catch() is dead code
                // when offline. We must queue here ourselves.
                const resolvedCounts = countsCompleted > 0
                    ? countsCompleted
                    : Math.max(0, malasCompleted) * 108;

                const cached = getCachedProfile(userId);
                if (cached) {
                    const currentStats = cached.stats;
                    const newStreak = calculateStreak(currentStats.lastChantDate, currentStats.streakDays || 0);
                    const today = getTodayDate();
                    setCachedProfile(userId, {
                        ...cached,
                        stats: {
                            totalMalas: (currentStats.totalMalas || 0) + Math.max(0, malasCompleted),
                            totalMantras: (currentStats.totalMantras || 0) + Math.max(0, resolvedCounts),
                            streakDays: newStreak,
                            lastChantDate: today
                        }
                    });
                }

                // Queue so syncPending() in JapaCounter will write to Firestore on reconnect
                storage.enqueueSync({
                    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                    createdAt: new Date().toISOString(),
                    counts: Math.max(0, resolvedCounts),
                    malas: Math.max(0, malasCompleted),
                    completed: true
                });
            },
            "Update User Stats"
        );
    }
};
