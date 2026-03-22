import React, { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Button, CircularProgress, Alert, Fab,
    Dialog
} from '@mui/material';
import { Plus } from 'lucide-react';
import { pledgeService } from '../../services/pledgeService';
import { Pledge, PledgeParticipant } from '../../types/pledge';
import { PledgeCard } from '../PledgeCard';
import { PledgeForm } from '../PledgeForm';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/community';
import { User } from 'firebase/auth';

interface CommunityPledgesTabProps {
    communityId: string;
    currentUserRole?: UserRole;
}

export const CommunityPledgesTab: React.FC<CommunityPledgesTabProps> = ({ communityId, currentUserRole }) => {
    const { user } = useAuth();
    const [pledges, setPledges] = useState<Pledge[]>([]);
    const [myParticipations, setMyParticipations] = useState<PledgeParticipant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [data, myData] = await Promise.all([
                pledgeService.getCommunityPledges(communityId),
                user ? pledgeService.getMyPledges(user.uid) : Promise.resolve([])
            ]);
            setPledges(data);
            setMyParticipations(myData);
        } catch (e: any) {
            setError(e.message || 'Failed to load pledges');
        } finally {
            setLoading(false);
        }
    }, [communityId, user]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async (data: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>) => {
        if (!user) return;
        setCreating(true);
        setCreateError(null);
        try {
            await pledgeService.createPledge({ ...data, communityId }, user as User);
            setShowForm(false);
            await load();
        } catch (e: any) {
            setCreateError(e.message || 'Failed to create pledge');
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = async (pledge: Pledge) => {
        if (!user) { alert('Please sign in to join a pledge.'); return; }
        const alreadyJoined = myParticipations.some(p => p.pledgeId === pledge.id);
        try {
            await pledgeService.joinPledge(pledge, user as User, alreadyJoined);
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to join pledge');
        }
    };

    const handleLeave = async (pledge: Pledge) => {
        if (!user) return;
        try {
            await pledgeService.leavePledge(pledge.id, user.uid);
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to leave pledge');
        }
    };

    const handleDelete = async (pledge: Pledge) => {
        if (!window.confirm(`Delete "${pledge.title}"? This cannot be undone.`)) return;
        try {
            await pledgeService.deletePledge(pledge.id, user?.uid || '');
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to delete pledge');
        }
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ height: '100%', overflowY: 'auto', p: 2, pb: 10, position: 'relative' }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>
            )}

            {pledges.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 8, opacity: 0.7 }}>
                    <Typography variant="h6" gutterBottom>No Community Pledges Yet</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Start a collective spiritual cause for this community.
                    </Typography>
                    {user && (
                        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setShowForm(true)}>
                            Create Community Pledge
                        </Button>
                    )}
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {pledges.map(pledge => {
                        const isJoined = myParticipations.some(p => p.pledgeId === pledge.id);
                        const myContrib = myParticipations.find(p => p.pledgeId === pledge.id)?.contributedMalas;
                        const canManage = isAdmin || pledge.creatorId === user?.uid;
                        return (
                            <PledgeCard
                                key={pledge.id}
                                pledge={pledge}
                                isJoined={isJoined}
                                onJoin={handleJoin}
                                onLeave={handleLeave}
                                myContribution={myContrib}
                                canManage={canManage}
                                onDelete={handleDelete}
                            />
                        );
                    })}
                </Box>
            )}

            {/* FAB to create pledge */}
            {user && (
                <Fab
                    color="primary"
                    onClick={() => setShowForm(true)}
                    sx={{ position: 'fixed', bottom: 80, right: 20, zIndex: 10 }}
                    size="medium"
                >
                    <Plus size={20} />
                </Fab>
            )}

            {/* Create Pledge Dialog */}
            <Dialog open={showForm} onClose={() => { setShowForm(false); setCreateError(null); }} maxWidth="sm" fullWidth>
                <PledgeForm
                    onClose={() => { setShowForm(false); setCreateError(null); }}
                    onSubmit={handleCreate}
                    loading={creating}
                    serverError={createError}
                />
            </Dialog>
        </Box>
    );
};
