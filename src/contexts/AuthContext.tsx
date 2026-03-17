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

// Mobile browsers and PWA block/ignore signInWithPopup silently.
// Use signInWithRedirect for these environments instead.
const shouldUseRedirect = (): boolean => {
    const ua = navigator.userAgent;
    const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;
    return isMobileBrowser || isPWA;
};

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
                    // Redirect completed — onAuthStateChanged will fire with the user
                    console.log('Redirect sign-in completed:', result.user.email);
                }
            })
            .catch((err) => {
                if (err?.code && err.code !== 'auth/no-auth-event') {
                    console.warn('getRedirectResult error:', err.code);
                }
            })
            .finally(() => {
                redirectChecked = true;
                tryFinishLoading();
            });

        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                    if (userDoc.exists()) {
                        const data = userDoc.data();
                        setAuthUser({
                            uid: currentUser.uid,
                            displayName: data.displayName || currentUser.displayName,
                            email: data.email || currentUser.email,
                            photoURL: data.photoURL || currentUser.photoURL,
                            isAnonymous: currentUser.isAnonymous,
                            role: data.role || 'user',
                            status: data.status || 'active',
                            plan: data.plan || 'free',
                        });
                    } else {
                        setAuthUser({
                            uid: currentUser.uid,
                            displayName: currentUser.displayName,
                            email: currentUser.email,
                            photoURL: currentUser.photoURL,
                            isAnonymous: currentUser.isAnonymous,
                            role: 'user',
                            status: 'active',
                            plan: 'free',
                        });
                    }
                } catch (error) {
                    console.error('Failed to fetch user document', error);
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

        // Mobile / PWA: use redirect (popup silently fails on mobile browsers)
        if (shouldUseRedirect()) {
            try {
                // Explicitly set LOCAL persistence before redirect so tokens
                // survive the page navigation and are available on return.
                await setPersistence(auth, browserLocalPersistence);
                await signInWithRedirect(auth, provider);
                // Page navigates away — execution stops here.
                // On return, getRedirectResult() in the useEffect above completes the flow.
            } catch (error: any) {
                console.error('Redirect sign-in failed', error);
                alert('Login Failed: ' + (error.message || error));
                signingIn.current = false;
            }
            return;
        }

        // Desktop: use popup
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            // User closed or cancelled popup — not a real error, ignore silently.
            const silent = ['auth/cancelled-popup-request', 'auth/popup-closed-by-user'];
            if (silent.includes(error?.code)) {
                console.warn('Sign-in popup cancelled:', error.code);
                return;
            }
            // Popup blocked — fall back to redirect
            if (error?.code === 'auth/popup-blocked' ||
                error?.code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    await setPersistence(auth, browserLocalPersistence);
                    await signInWithRedirect(auth, provider);
                    return;
                } catch (redirectError: any) {
                    console.error('Redirect fallback failed', redirectError);
                }
            }
            console.error('Error signing in with Google', error);
            alert('Login Failed: ' + (error.message || error));
            throw error;
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
