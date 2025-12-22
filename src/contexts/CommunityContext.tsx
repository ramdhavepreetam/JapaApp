import React, { createContext, useContext, useEffect, useState } from 'react';
import { Pledge, PledgeParticipant, communityService } from '../services/community';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CommunityContextType {
    pledges: Pledge[];
    myPledges: PledgeParticipant[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const CommunityContext = createContext<CommunityContextType | undefined>(undefined);

export const CommunityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [pledges, setPledges] = useState<Pledge[]>([]);
    const [myPledges, setMyPledges] = useState<PledgeParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial Load & Real-time Listeners
    useEffect(() => {
        setLoading(true);

        // 1. Listen to All Pledges (Global)
        const pledgesQuery = query(collection(db, 'pledges'));
        const unsubPledges = onSnapshot(pledgesQuery, (snapshot) => {
            const updatedPledges = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Pledge));
            setPledges(updatedPledges);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching pledges:", err);
            setError("Failed to load community pledges.");
            setLoading(false);
        });

        // 2. Listen to My Pledges (User Specific)
        let unsubMyPledges: () => void;
        if (user) {
            const myPledgesQuery = query(
                collection(db, 'pledge_participants'),
                where('userId', '==', user.uid)
            );
            unsubMyPledges = onSnapshot(myPledgesQuery, (snapshot) => {
                const updatedMyPledges = snapshot.docs.map(doc => doc.data() as PledgeParticipant);
                setMyPledges(updatedMyPledges);
            }, (err) => {
                console.error("Error fetching my pledges:", err);
            });
        } else {
            setMyPledges([]);
        }

        return () => {
            unsubPledges();
            if (unsubMyPledges) unsubMyPledges();
        };
    }, [user]);

    const refresh = async () => {
        try {
            setLoading(true);
            const [allPledges, userPledges] = await Promise.all([
                communityService.getPledges(),
                user ? communityService.getMyPledges(user.uid) : Promise.resolve([])
            ]);
            setPledges(allPledges);
            setMyPledges(userPledges);
        } catch (err) {
            console.error("Refresh failed", err);
            // Don't set global error here to avoid blocking UI if just a refresh fails
        } finally {
            setLoading(false);
        }
    };

    return (
        <CommunityContext.Provider value={{ pledges, myPledges, loading, error, refresh }}>
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
