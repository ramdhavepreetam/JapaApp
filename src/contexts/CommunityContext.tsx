import React, { createContext, useContext, useEffect, useState } from 'react';
import { PledgeParticipant } from '../types/pledge';
import { pledgeService } from '../services/pledgeService';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CommunityContextType {
    myPledges: PledgeParticipant[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [myPledges, setMyPledges] = useState<PledgeParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);

        // Listen to My Pledges (User Specific — community pledges the user has joined)
        let unsubMyPledges: () => void;
        if (user) {
            const myPledgesQuery = query(
                collection(db, 'pledge_participants'),
                where('userId', '==', user.uid)
            );
            unsubMyPledges = onSnapshot(myPledgesQuery, (snapshot) => {
                const updatedMyPledges = snapshot.docs.map(doc => doc.data() as PledgeParticipant);
                setMyPledges(updatedMyPledges);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching my pledges:", err);
                setError("Failed to load pledges.");
                setLoading(false);
            });
        } else {
            setMyPledges([]);
            setLoading(false);
        }

        return () => {
            if (unsubMyPledges) unsubMyPledges();
        };
    }, [user]);

    const refresh = async () => {
        try {
            setLoading(true);
            const userPledges = user
                ? await pledgeService.getMyPledges(user.uid)
                : [];
            setMyPledges(userPledges);
        } catch (err) {
            console.error("Refresh failed", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <CommunityContext.Provider value={{ myPledges, loading, error, refresh }}>
            {children}
        </CommunityContext.Provider>
    );
};

export const useCommunity = () => {
    const context = useContext(CommunityContext);
    if (!context) {
        throw new Error('useCommunity must be used within a CommunityProvider');
    }
    return context;
};
