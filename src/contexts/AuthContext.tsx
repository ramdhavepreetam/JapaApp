import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged } from 'firebase/auth';
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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const signingIn = useRef(false); // guard against double-tap / concurrent popup requests

    // On app load, check for a pending redirect result (mobile/PWA sign-in flow)
    useEffect(() => {
        getRedirectResult(auth).catch((err) => {
            // Ignore — no pending redirect or already handled by onAuthStateChanged
            if (err?.code !== 'auth/no-auth-event') {
                console.warn('getRedirectResult error (non-critical):', err?.code);
            }
        });
    }, []);

    useEffect(() => {
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
                        // Document doesn't exist yet, provide minimal authUser
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
                    console.error("Failed to fetch user document", error);
                }
            } else {
                setAuthUser(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        // Prevent duplicate popup requests (double-tap, rapid re-click)
        if (signingIn.current) return;
        signingIn.current = true;

        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            // These codes are not real errors — the user or browser simply closed/cancelled the popup.
            // Show nothing; let the user try again.
            const silent = ['auth/cancelled-popup-request', 'auth/popup-closed-by-user', 'auth/popup-blocked'];
            if (silent.includes(error?.code)) {
                console.warn('Sign-in popup cancelled:', error.code);
                return;
            }

            // For popup-blocked on mobile/PWA, fall back to redirect flow
            if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') {
                try {
                    await signInWithRedirect(auth, provider);
                    return;
                } catch (redirectError: any) {
                    console.error('Redirect sign-in also failed', redirectError);
                }
            }

            console.error("Error signing in with Google", error);
            alert("Login Failed: " + (error.message || error));
            throw error;
        } finally {
            signingIn.current = false;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error signing out", error);
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
