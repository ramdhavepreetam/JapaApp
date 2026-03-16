import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Triggered when a new Firebase Auth user is created.
 * Creates the Firestore user profile document server-side,
 * preventing race conditions and unauthorized writes from the client.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
    const db = admin.firestore();
    const userRef = db.doc(`users/${user.uid}`);
    const snap = await userRef.get();
    if (snap.exists) return; // Already created (e.g. by a concurrent client call)

    await userRef.set({
        uid: user.uid,
        displayName: user.displayName || 'Devotee',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        stats: {
            totalMalas: 0,
            totalMantras: 0,
            streakDays: 0,
            lastChantDate: null,
        }
    });
});

// Re-export existing payment functions
export { createRazorpayOrder, razorpayWebhook } from './razorpayWebhook';
