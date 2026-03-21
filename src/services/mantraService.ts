import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { Mantra } from '../types/mantra';
import { runWithFallback } from './resilience';

// Offline fallback — shown when Firestore is unavailable (no audioUrl means no audio)
const FALLBACK_MANTRAS: Mantra[] = [
    { id: 'fallback_1', name: 'Om Namah Shivaya', nameDevanagari: 'ॐ नमः शिवाय', tradition: 'Shaiva', audioUrl: '', position: 1 },
    { id: 'fallback_2', name: 'Gayatri Mantra', nameDevanagari: 'ॐ भूर्भुवः स्वः', tradition: 'Vedic', audioUrl: '', position: 2 },
    { id: 'fallback_3', name: 'Hare Krishna Maha Mantra', nameDevanagari: 'हरे कृष्ण हरे कृष्ण', tradition: 'Vaishnava', audioUrl: '', position: 3 },
    { id: 'fallback_4', name: 'Mahamrityunjaya Mantra', nameDevanagari: 'ॐ त्र्यम्बकं यजामहे', tradition: 'Shaiva', audioUrl: '', position: 4 },
    { id: 'fallback_5', name: 'Om Mani Padme Hum', nameDevanagari: 'ॐ मणि पद्मे हूँ', tradition: 'Buddhist', audioUrl: '', position: 5 },
];

export const mantraService = {
    getMantras: async (): Promise<Mantra[]> => {
        return runWithFallback(
            async () => {
                const q = query(collection(db, 'mantras'), orderBy('position', 'asc'));
                const snap = await getDocs(q);
                return snap.docs.map(d => ({ id: d.id, ...d.data() } as Mantra));
            },
            async () => FALLBACK_MANTRAS,
            'Get Mantras'
        );
    },

    addMantra: async (mantra: Omit<Mantra, 'id'>, adminUid: string): Promise<Mantra> => {
        const data = { ...mantra, addedBy: adminUid, addedAt: serverTimestamp() };
        const ref = await addDoc(collection(db, 'mantras'), data);
        return { id: ref.id, ...mantra };
    },

    deleteMantra: async (mantraId: string): Promise<void> => {
        await deleteDoc(doc(db, 'mantras', mantraId));
    },
};
