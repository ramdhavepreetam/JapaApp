import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAnalytics } from 'firebase/analytics';


// Your web app's Firebase configuration
// For now, these are placeholders. You will need to create a project in the Firebase Console
// and replace these with your actual config keys.
// Hardcoded config for debugging to ensure values are correct
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

// App Check — only initialize if a valid site key is configured
const recaptchaKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
export const appCheck = recaptchaKey
    ? (() => {
        if (import.meta.env.DEV) {
            (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
        }
        try {
            return initializeAppCheck(app, {
                provider: new ReCaptchaV3Provider(recaptchaKey),
                isTokenAutoRefreshEnabled: true
            });
        } catch (e) {
            console.warn('App Check initialization failed:', e);
            return null;
        }
    })()
    : null;

// Analytics (enabled only when measurementId is configured)
export const analytics = firebaseConfig.measurementId ? getAnalytics(app) : null;

// Helper to log if we are running in mock mode
if (firebaseConfig.apiKey === "MOCK_KEY") {
    console.warn("⚠️ Firebase is running with MOCK keys. Database features will not work until you add valid credentials to .env.local");
} else {
    console.log("Firebase Config Loaded:", {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        apiKeyLength: firebaseConfig.apiKey?.length
    });
}
