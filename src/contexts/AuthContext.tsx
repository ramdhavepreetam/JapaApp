import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
    User, GoogleAuthProvider,
    signInWithPopup,
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


export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [authUser, setAuthUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const signingIn = useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // Set baseline authUser immediately so UI never flashes "Sign in"
                // while waiting for the Firestore fetch (or if it fails).
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
                } catch (error) {
                    console.error('Failed to fetch user document — using Firebase user data', error);
                    // baseAuthUser already set above, user stays logged in
                }
            } else {
                setAuthUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        if (signingIn.current) return;
        signingIn.current = true;

        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error: any) {
            const silent = ['auth/cancelled-popup-request', 'auth/popup-closed-by-user'];
            if (!silent.includes(error?.code)) {
                console.error('Error signing in with Google', error);
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
