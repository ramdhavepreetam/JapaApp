import { db } from '../lib/firebase';
import {
    collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
    query, orderBy, Timestamp, increment
} from 'firebase/firestore';

import { PersonalPledge } from '../types/pledge';
import { runWithFallback } from './resilience';

// --- MOCK IMPLEMENTATION (LocalStorage) ---

const getMockKey = (uid: string) => `japa_mock_personal_pledges_${uid}`;

const mockService = {
    getPersonalPledges: async (uid: string): Promise<PersonalPledge[]> => {
        const stored = localStorage.getItem(getMockKey(uid));
        return stored ? JSON.parse(stored) : [];
    },

    createPersonalPledge: async (uid: string, data: Omit<PersonalPledge, 'id' | 'createdAt' | 'currentMalas'>): Promise<PersonalPledge> => {
        await new Promise(r => setTimeout(r, 400));
        const pledges = await mockService.getPersonalPledges(uid);
        const newPledge: PersonalPledge = {
            id: `mock_personal_${Date.now()}`,
            ...data,
            currentMalas: 0,
            createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as Timestamp
        };
        pledges.unshift(newPledge);
        localStorage.setItem(getMockKey(uid), JSON.stringify(pledges));
        return newPledge;
    },

    updatePersonalPledge: async (uid: string, pledgeId: string, updates: Partial<PersonalPledge>): Promise<void> => {
        const pledges = await mockService.getPersonalPledges(uid);
        const index = pledges.findIndex(p => p.id === pledgeId);
        if (index === -1) throw new Error("Personal pledge not found");
        pledges[index] = { ...pledges[index], ...updates };
        localStorage.setItem(getMockKey(uid), JSON.stringify(pledges));
    },

    deletePersonalPledge: async (uid: string, pledgeId: string): Promise<void> => {
        const pledges = await mockService.getPersonalPledges(uid);
        const filtered = pledges.filter(p => p.id !== pledgeId);
        localStorage.setItem(getMockKey(uid), JSON.stringify(filtered));
    },

    contributeToPersonalPledge: async (uid: string, pledgeId: string, malas: number): Promise<void> => {
        const pledges = await mockService.getPersonalPledges(uid);
        const index = pledges.findIndex(p => p.id === pledgeId);
        if (index !== -1) {
            pledges[index].currentMalas += malas;
            localStorage.setItem(getMockKey(uid), JSON.stringify(pledges));
        }
    }
};

// --- REAL SERVICE (with Global Fallback) ---

export const personalPledgeService = {
    getPersonalPledges: async (uid: string): Promise<PersonalPledge[]> => {
        if (!uid) return [];
        return runWithFallback(
            async () => {
                const q = query(
                    collection(db, 'users', uid, 'pledges'),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(q);
                return snap.docs.map(d => ({ id: d.id, ...d.data() } as PersonalPledge));
            },
            () => mockService.getPersonalPledges(uid),
            "Get Personal Pledges"
        );
    },

    createPersonalPledge: async (uid: string, data: Omit<PersonalPledge, 'id' | 'createdAt' | 'currentMalas'>): Promise<PersonalPledge> => {
        if (!uid) throw new Error("Requires authentication to create a personal pledge");
        return runWithFallback(
            async () => {
                const pledgeData = {
                    ...data,
                    currentMalas: 0,
                    createdAt: Timestamp.now()
                };
                const docRef = await addDoc(collection(db, 'users', uid, 'pledges'), pledgeData);
                return { id: docRef.id, ...pledgeData };
            },
            () => mockService.createPersonalPledge(uid, data),
            "Create Personal Pledge"
        );
    },

    updatePersonalPledge: async (uid: string, pledgeId: string, updates: Partial<PersonalPledge>): Promise<void> => {
        if (!uid) throw new Error("Requires authentication to update a personal pledge");
        return runWithFallback(
            async () => {
                const pledgeRef = doc(db, 'users', uid, 'pledges', pledgeId);
                await updateDoc(pledgeRef, updates as Record<string, unknown>);
            },
            () => mockService.updatePersonalPledge(uid, pledgeId, updates),
            "Update Personal Pledge"
        );
    },

    deletePersonalPledge: async (uid: string, pledgeId: string): Promise<void> => {
        if (!uid) throw new Error("Requires authentication to delete a personal pledge");
        return runWithFallback(
            async () => {
                const pledgeRef = doc(db, 'users', uid, 'pledges', pledgeId);
                await deleteDoc(pledgeRef);
            },
            () => mockService.deletePersonalPledge(uid, pledgeId),
            "Delete Personal Pledge"
        );
    },

    contributeToPersonalPledge: async (uid: string, pledgeId: string, malas: number): Promise<void> => {
        if (!uid) throw new Error("Requires authentication to contribute");
        if (malas <= 0) return;
        return runWithFallback(
            async () => {
                const pledgeRef = doc(db, 'users', uid, 'pledges', pledgeId);
                await updateDoc(pledgeRef, { currentMalas: increment(malas) });
            },
            () => mockService.contributeToPersonalPledge(uid, pledgeId, malas),
            "Contribute to Personal Pledge"
        );
    }
};
