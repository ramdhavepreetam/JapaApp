import { db } from '../lib/firebase';
import {
    collection, doc, getDocs, query, where,
    increment, writeBatch, Timestamp, addDoc, updateDoc, limit, orderBy
} from 'firebase/firestore';
import { User } from 'firebase/auth';

import { Pledge, PledgeParticipant } from '../types/pledge';
import { runWithFallback } from './resilience';
import { track } from '../lib/analytics';

// --- MOCK IMPLEMENTATION (LocalStorage) ---
const LOCAL_STORAGE_KEY_PLEDGES = 'japa_mock_pledges';
const LOCAL_STORAGE_KEY_PARTICIPANTS = 'japa_mock_participants';

const mockService = {
    getPledges: async (): Promise<Pledge[]> => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PLEDGES);
        if (stored) {
            return JSON.parse(stored);
        }
        // Seed default mocks
        const defaults: Pledge[] = [
            {
                id: 'mock_1',
                title: "World Peace Chant (Demo)",
                description: "1 Million Malas for global harmony and peace. (Running in Demo Mode)",
                targetMalas: 1000000,
                currentMalas: 5020,
                participants: 125,
                mantra: "Om Shanti Shanti Shanti"
            },
            {
                id: 'mock_2',
                title: "Om Namah Shivaya (Demo)",
                description: "Global community chanting. (Running in Demo Mode)",
                targetMalas: 108000,
                currentMalas: 1200,
                participants: 45,
                mantra: "Om Namah Shivaya"
            }
        ];
        localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(defaults));
        return defaults;
    },

    createPledge: async (pledge: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>, user: User): Promise<Pledge> => {
        await new Promise(r => setTimeout(r, 800)); // Simulate network delay

        const pledges = await mockService.getPledges();

        // Limit check
        const myCount = pledges.filter(p => p.creatorId === user.uid).length;
        if (myCount >= 50) {
            throw new Error("You have reached the limit of 50 causes per user.");
        }

        if (pledges.some(p => p.title === pledge.title)) {
            throw new Error("A pledge with this name already exists (Demo).");
        }

        const newPledge: Pledge = {
            id: `mock_${Date.now()}`,
            ...pledge,
            currentMalas: 0,
            participants: 1,
            creatorId: user.uid
        };

        pledges.push(newPledge);
        localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(pledges));

        // Auto-join
        await mockService.joinPledge(newPledge, user);
        return newPledge;
    },

    leavePledge: async (pledgeId: string, userId: string): Promise<void> => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
        let participants: PledgeParticipant[] = stored ? JSON.parse(stored) : [];

        // Remove participant
        const initialLen = participants.length;
        participants = participants.filter(p => !(p.pledgeId === pledgeId && p.userId === userId));

        if (participants.length < initialLen) {
            localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));

            // Decrement pledge count
            const pledges = await mockService.getPledges();
            const pIndex = pledges.findIndex(p => p.id === pledgeId);
            if (pIndex !== -1) {
                pledges[pIndex].participants = Math.max(0, pledges[pIndex].participants - 1);
                localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(pledges));
            }
        }
    },

    joinPledge: async (pledge: Pledge, user: User, alreadyJoined: boolean = false): Promise<void> => {
        if (alreadyJoined) return;

        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
        const participants: PledgeParticipant[] = stored ? JSON.parse(stored) : [];

        const validUser = user || { uid: "guest", displayName: "Guest" };
        const pid = `${pledge.id}_${validUser.uid}`;

        if (!participants.find(p => p.id === pid)) {
            const newPart: PledgeParticipant = {
                id: pid,
                pledgeId: pledge.id,
                userId: validUser.uid,
                userDisplayName: validUser.displayName || 'Sadhaka',
                pledgeTitle: pledge.title,
                pledgeTarget: pledge.targetMalas,
                contributedMalas: 0,
                joinedAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as Timestamp
            };
            participants.push(newPart);
            localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));

            // Update pledge count
            const pledges = await mockService.getPledges();
            const pIndex = pledges.findIndex(p => p.id === pledge.id);
            if (pIndex !== -1) {
                pledges[pIndex].participants += 1;
                localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(pledges));
            }
        }
    },

    getMyPledges: async (userId: string): Promise<PledgeParticipant[]> => {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
        const participants: PledgeParticipant[] = stored ? JSON.parse(stored) : [];
        return participants.filter(p => p.userId === userId);
    },

    contribute: async (pledgeId: string, userId: string, malas: number): Promise<void> => {
        const storedParts = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
        let participants: PledgeParticipant[] = storedParts ? JSON.parse(storedParts) : [];

        const partIndex = participants.findIndex(p => p.pledgeId === pledgeId && p.userId === userId);
        if (partIndex !== -1) {
            participants[partIndex].contributedMalas += malas;
            localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));

            // Update global
            const pledges = await mockService.getPledges();
            const pIndex = pledges.findIndex(p => p.id === pledgeId);
            if (pIndex !== -1) {
                pledges[pIndex].currentMalas += malas;
                localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(pledges));
            }
        }
    },

    deletePledge: async (pledgeId: string): Promise<void> => {
        let pledges = await mockService.getPledges();
        pledges = pledges.filter(p => p.id !== pledgeId);
        localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(pledges));

        // Cleanup participants
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PARTICIPANTS);
        let participants: PledgeParticipant[] = stored ? JSON.parse(stored) : [];
        participants = participants.filter(p => p.pledgeId !== pledgeId);
        localStorage.setItem(LOCAL_STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));
    },

    updatePledge: async (pledgeId: string, updates: Partial<Pledge>): Promise<Pledge> => {
        const pledges = await mockService.getPledges();
        const index = pledges.findIndex(p => p.id === pledgeId);
        if (index === -1) throw new Error("Pledge not found");

        pledges[index] = { ...pledges[index], ...updates };
        localStorage.setItem(LOCAL_STORAGE_KEY_PLEDGES, JSON.stringify(pledges));
        return pledges[index];
    }
};

// --- REAL SERVICE (with Global Fallback) ---

export const pledgeService = {
    // Initialize standard pledges if they don't exist
    seedInitialPledges: async () => {
        return runWithFallback(
            async () => {
                const pledgesRef = collection(db, 'pledges');
                const snapshot = await getDocs(pledgesRef);
                if (snapshot.empty) {
                    // Seeding is typically done by admin; safe to no-op here
                }
            },
            async () => { /* no-op in offline mode */ },
            "Seed Initial Pledges"
        );
    },

    getPledges: async (limitCount: number = 50): Promise<Pledge[]> => {
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'pledges'),
                    orderBy('participants', 'desc'),
                    limit(limitCount)
                );
                const querySnapshot = await getDocs(q);
                return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Pledge));
            },
            mockService.getPledges,
            "Listing Pledges"
        );
    },

    createPledge: async (pledge: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>, user: User): Promise<Pledge> => {
        if (!user?.uid) throw new Error("Requires authentication to create a pledge");
        return runWithFallback(
            async () => {
                // 0. Limit Check (Max 50)
                const limitQ = query(collection(db, 'pledges'), where('creatorId', '==', user.uid));
                const limitSnap = await getDocs(limitQ);
                if (limitSnap.size >= 50) {
                    throw new Error("You have reached the limit of 50 causes per user.");
                }

                // 1. Check uniqueness
                const q = query(collection(db, 'pledges'), where('title', '==', pledge.title));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    throw new Error("A pledge with this name already exists. Please choose a unique name.");
                }

                const newPledgeData = {
                    ...pledge,
                    currentMalas: 0,
                    participants: 1,
                    creatorId: user.uid
                };

                const docRef = await addDoc(collection(db, 'pledges'), newPledgeData);
                const newPledge = { id: docRef.id, ...newPledgeData };
                await pledgeService.joinPledge(newPledge, user);
                return newPledge;
            },
            () => mockService.createPledge(pledge, user),
            "Creating Pledge"
        );
    },

    joinPledge: async (pledge: Pledge, user: User, alreadyJoined: boolean = false): Promise<void> => {
        if (!user?.uid) throw new Error("Requires authentication to join a pledge");
        return runWithFallback(
            async () => {
                if (alreadyJoined) return;
                const participationId = `${pledge.id}_${user.uid}`;
                const participationRef = doc(db, 'pledge_participants', participationId);
                const participantData: PledgeParticipant = {
                    id: participationId,
                    pledgeId: pledge.id,
                    userId: user.uid,
                    userDisplayName: user.displayName || 'Sadhaka',
                    pledgeTitle: pledge.title,
                    pledgeTarget: pledge.targetMalas,
                    contributedMalas: 0,
                    joinedAt: Timestamp.now()
                };
                const batch = writeBatch(db);
                batch.set(participationRef, participantData);
                const pledgeRef = doc(db, 'pledges', pledge.id);
                batch.update(pledgeRef, { participants: increment(1) });
                await batch.commit();
            },
            () => mockService.joinPledge(pledge, user, alreadyJoined),
            "Joining Pledge"
        );
    },

    leavePledge: async (pledgeId: string, userId: string): Promise<void> => {
        if (!userId) throw new Error("Requires authentication to leave a pledge");
        return runWithFallback(
            async () => {
                const participationId = `${pledgeId}_${userId}`;
                const participationRef = doc(db, 'pledge_participants', participationId);
                const pledgeRef = doc(db, 'pledges', pledgeId);

                const batch = writeBatch(db);
                batch.delete(participationRef);
                batch.update(pledgeRef, { participants: increment(-1) });
                await batch.commit();
            },
            () => mockService.leavePledge(pledgeId, userId),
            "Leaving Pledge"
        );
    },

    getMyPledges: async (userId: string): Promise<PledgeParticipant[]> => {
        return runWithFallback(
            async () => {
                const q = query(collection(db, 'pledge_participants'), where('userId', '==', userId));
                const snapshot = await getDocs(q);
                return snapshot.docs.map(doc => doc.data() as PledgeParticipant);
            },
            () => mockService.getMyPledges(userId),
            "Getting My Pledges"
        );
    },

    contribute: async (pledgeId: string, userId: string, malas: number): Promise<void> => {
        if (!userId) throw new Error("Requires authentication to contribute");
        return runWithFallback(
            async () => {
                if (malas <= 0) return;
                const participationId = `${pledgeId}_${userId}`;
                const participationRef = doc(db, 'pledge_participants', participationId);
                const pledgeRef = doc(db, 'pledges', pledgeId);
                const batch = writeBatch(db);
                batch.update(participationRef, { contributedMalas: increment(malas) });
                batch.update(pledgeRef, { currentMalas: increment(malas) });
                await batch.commit();
                track.pledgeContributed(pledgeId, malas);
            },
            () => mockService.contribute(pledgeId, userId, malas),
            "Contribute"
        );
    },

    deletePledge: async (pledgeId: string, _userId: string): Promise<void> => {
        if (!_userId) throw new Error("Requires authentication to delete a pledge");
        return runWithFallback(
            async () => {
                const pledgeRef = doc(db, 'pledges', pledgeId);

                // Get all participants
                const q = query(collection(db, 'pledge_participants'), where('pledgeId', '==', pledgeId));
                const snap = await getDocs(q);

                // Firestore writeBatch is capped at 500 operations.
                // Chunk participant deletes into batches of 499, then delete the pledge doc
                // in the final batch to keep the operation atomic across chunks.
                const BATCH_LIMIT = 499;
                const participantRefs = snap.docs.map(d => d.ref);

                for (let i = 0; i < participantRefs.length; i += BATCH_LIMIT) {
                    const chunk = participantRefs.slice(i, i + BATCH_LIMIT);
                    const batch = writeBatch(db);
                    chunk.forEach(ref => batch.delete(ref));
                    // Include the pledge doc deletion only in the last batch
                    if (i + BATCH_LIMIT >= participantRefs.length) {
                        batch.delete(pledgeRef);
                    }
                    await batch.commit();
                }

                // If no participants existed, delete the pledge doc standalone
                if (participantRefs.length === 0) {
                    const batch = writeBatch(db);
                    batch.delete(pledgeRef);
                    await batch.commit();
                }
            },
            () => mockService.deletePledge(pledgeId),
            "Deleting Pledge"
        );
    },

    updatePledge: async (pledgeId: string, updates: Partial<Pledge>, _userId: string): Promise<Pledge> => {
        if (!_userId) throw new Error("Requires authentication to update a pledge");
        return runWithFallback(
            async () => {
                const pledgeRef = doc(db, 'pledges', pledgeId);
                await updateDoc(pledgeRef, updates);
                return { id: pledgeId, ...updates } as Pledge; // incomplete return but sufficient for UI update usually
            },
            () => mockService.updatePledge(pledgeId, updates),
            "Updating Pledge"
        );
    }
};
