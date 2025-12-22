import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { User } from 'firebase/auth';

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

export const userService = {
    // Ensure user document exists in Firestore on first login
    ensureUserExists: async (user: User) => {
        if (!user) return;

        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            return userService.createProfile(user);
        } else {
            return userSnap.data() as UserProfile;
        }
    },

    // Optimized method for when we know the user is new (e.g. from onSnapshot missing)
    createProfile: async (user: User): Promise<UserProfile> => {
        const userRef = doc(db, 'users', user.uid);
        const newProfile: UserProfile = {
            uid: user.uid,
            displayName: user.displayName || 'Sadhaka',
            photoURL: user.photoURL || '',
            email: user.email || '',
            stats: {
                totalMalas: 0,
                totalMantras: 0,
                streakDays: 0,
                lastChantDate: null
            },
            joinedAt: Timestamp.now()
        };
        // Use setDoc with merge: true just in case, but essentially this is a blind write for speed
        await setDoc(userRef, newProfile, { merge: true });
        return newProfile;
    },

    getUserProfile: async (uid: string) => {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? userSnap.data() as UserProfile : null;
    },

    updateUserStats: async (userId: string, malasCompleted: number = 0, countsCompleted: number = 0) => {
        if (malasCompleted <= 0 && countsCompleted <= 0) return;
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return; // Should account for ensureUserExists previously called ideally

        const data = userSnap.data() as UserProfile;
        const currentStats = data.stats || {
            totalMalas: 0,
            totalMantras: 0,
            streakDays: 0,
            lastChantDate: null
        };

        const resolvedCounts = countsCompleted > 0
            ? countsCompleted
            : Math.max(0, malasCompleted) * 108;

        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        let newStreak = currentStats.streakDays;

        // Streak Logic
        if (currentStats.lastChantDate === today) {
            // Already counted for today, keep streak same
        } else if (currentStats.lastChantDate === yesterday) {
            // Consecutive day
            newStreak += 1;
        } else {
            // Missed a day or first time
            newStreak = 1;
        }

        await setDoc(userRef, {
            stats: {
                ...currentStats,
                totalMalas: (currentStats.totalMalas || 0) + Math.max(0, malasCompleted),
                totalMantras: (currentStats.totalMantras || 0) + Math.max(0, resolvedCounts),
                streakDays: newStreak,
                lastChantDate: today
            }
        }, { merge: true });
    }
};
