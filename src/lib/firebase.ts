import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';
// import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';


// Firebase config, sourced from .env.local (see VITE_FIREBASE_* in CLAUDE.md)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);

// Initialize Firestore with new persistence settings
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// App Check is intentionally NOT initialized — reCAPTCHA iframe conflicts with
// the Firebase auth iframe (signInWithRedirect), causing "message port closed"
// errors on Safari and Chrome. Re-enable only after auth flow is fully migrated
// to a popup-free approach or App Check is enforced and tested independently.
export const appCheck = null;

// Analytics (enabled only when measurementId is configured)
export const analytics = firebaseConfig.measurementId ? getAnalytics(app) : null;

// Helper to log if we are running in mock mode
if (firebaseConfig.apiKey === "MOCK_KEY") {
    console.warn("⚠️ Firebase is running with MOCK keys. Database features will not work until you add valid credentials to .env.local");
} else if (import.meta.env.DEV) {
    console.log("Firebase Config Loaded:", {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKeyLength: firebaseConfig.apiKey?.length
    });
}
