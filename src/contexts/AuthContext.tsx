import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    User, GoogleAuthProvider,
    signInWithPopup, signInWithRedirect, getRedirectResult,
    setPersistence, browserLocalPersistence,
    signOut, onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AuthUser } from '../types/auth';

interface AuthContextType {
    user: User | null;
    authUser: AuthUser | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Only use redirect for PWA standalone mode — popups are always blocked there.
// Modern mobile browsers (Chrome Android, Safari iOS 16.4+) support popups and
// are more reliable than redirect because iOS ITP clears IndexedDB between
// cross-origin redirects (app → accounts.google.com → firebaseapp.com → app),
// which causes getRedirectResult() to return null and the user to appear signed out.
const isPWA = (): boolean =>
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const signingIn = useRef(false);

    useEffect(() => {
        // Keep loading=true until BOTH conditions are met:
        //   1. getRedirectResult() has resolved (checks for pending mobile redirect)
        //   2. onAuthStateChanged has fired (gives us the actual auth state)
        //
        // Without this gate, onAuthStateChanged fires null first while Firebase
        // is still processing the redirect result → app renders as "not signed in"
        // permanently on mobile even though the redirect succeeded.
        let onAuthFired = false;
        let redirectChecked = false;

        const tryFinishLoading = () => {
            if (onAuthFired && redirectChecked) setLoading(false);
        };

        // Must call getRedirectResult on every app load to complete any
        // pending redirect sign-in. Firebase will not fire onAuthStateChanged
        // with the user until this is resolved.
        getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    console.log('[Auth] getRedirectResult: user =', result.user.email);
                } else {
                    console.log('[Auth] getRedirectResult: null (no pending redirect)');
                }
            })
            .catch((err) => {
                console.warn('[Auth] getRedirectResult error:', err?.code, err?.message);
            })
            .finally(() => {
                redirectChecked = true;
                tryFinishLoading();
            });

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            console.log('[Auth] onAuthStateChanged fired, uid:', currentUser?.uid ?? 'null');
            setUser(currentUser);
            if (currentUser) {
                // Always set a baseline authUser immediately from the Firebase user so the
                // UI never shows "Sign in" while we wait for the Firestore fetch.
                const baseAuthUser = {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName,
                    email: currentUser.email,
                    photoURL: currentUser.photoURL,
                    isAnonymous: currentUser.isAnonymous,
                    role: 'user' as const,
                    status: 'active' as const,
                    plan: 'free' as const,
                };
                setAuthUser(baseAuthUser);

                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setAuthUser({
                            ...baseAuthUser,
                            displayName: data.displayName || currentUser.displayName,
                            email: data.email || currentUser.email,
                            photoURL: data.photoURL || currentUser.photoURL,
                            role: data.role || 'user',
                            status: data.status || 'active',
                            plan: data.plan || 'free',
                        });
                    }
                    // if doc doesn't exist yet (new user), keep baseAuthUser
                } catch (error) {
                    console.error('[Auth] Failed to fetch user document — using Firebase user data', error);
                    // Keep baseAuthUser that was already set above
                }
            } else {
                setAuthUser(null);
            }
            onAuthFired = true;
            tryFinishLoading();
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        if (signingIn.current) return;
        signingIn.current = true;

        const provider = new GoogleAuthProvider();

        // PWA (added to home screen): popup is always blocked → go straight to redirect.
        // All other environments (desktop + mobile browser): try popup first.
        // Modern mobile Chrome and Safari (iOS 16.4+) support popups reliably.
        // Redirect is a last resort because iOS ITP clears IndexedDB between
        // cross-origin hops, causing getRedirectResult to return null on return.
        if (isPWA()) {
            try {
                await setPersistence(auth, browserLocalPersistence);
                await signInWithRedirect(auth, provider);
                // Page navigates away — execution stops here.
            } catch (error: any) {
                console.error('[Auth] PWA redirect sign-in failed', error);
                alert('Login Failed: ' + (error.message || error));
                signingIn.current = false;
            }
            return;
        }

        // Popup first (works on desktop + modern mobile browsers)
        try {
            console.log('[Auth] Attempting signInWithPopup');
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            // User closed or cancelled popup — not a real error.
            const silent = ['auth/cancelled-popup-request', 'auth/popup-closed-by-user'];
            if (silent.includes(error?.code)) {
                console.warn('[Auth] Sign-in popup cancelled:', error.code);
                signingIn.current = false;
                return;
            }
            // Popup explicitly blocked (older Safari, some desktop ad-blockers) → redirect
            if (error?.code === 'auth/popup-blocked' ||
                error?.code === 'auth/operation-not-supported-in-this-environment') {
                console.warn('[Auth] Popup blocked, falling back to redirect:', error.code);
                try {
                    await setPersistence(auth, browserLocalPersistence);
                    await signInWithRedirect(auth, provider);
                    return;
                } catch (redirectError: any) {
                    console.error('[Auth] Redirect fallback failed', redirectError);
                    alert('Login Failed: ' + (redirectError.message || redirectError));
                }
            } else {
                console.error('[Auth] signInWithPopup error', error);
                alert('Login Failed: ' + (error.message || error));
            }
        } finally {
            signingIn.current = false;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Error signing out', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, authUser, loading, signInWithGoogle, logout }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
