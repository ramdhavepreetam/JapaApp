import React, { useState } from 'react';
import { ArrowLeft, Globe2, Plus } from 'lucide-react';
import { communityService } from '../services/pledgeService';
import { Pledge } from '../types/pledge';
import { PledgeCard } from './PledgeCard';
import { PledgeForm } from './PledgeForm';
import {
    Box,
    AppBar,
    Toolbar,
    IconButton,
    Typography,
    Button,
    Container,
    CircularProgress,
    Dialog,
    Snackbar,
    Alert
} from '@mui/material';

interface CommunityViewProps {
    onBack: () => void;
    onSelectPledge: (pledge: Pledge) => void;
}

import { useCommunity } from '../contexts/CommunityContext';
import { useAuth } from '../contexts/AuthContext';

export const CommunityView: React.FC<CommunityViewProps> = ({ onBack, onSelectPledge }) => {
    const { user } = useAuth();
    const { pledges, myPledges, loading: contextLoading, refresh } = useCommunity();
    const [operationLoading, setOperationLoading] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);

    // Initial load happens in Context now

    // Derived loading state
    const loading = contextLoading || operationLoading;

    // ... (loadPledges function removed as it's handled by context)

    const handleJoin = async (pledge: Pledge, isJoined: boolean) => {
        if (isJoined) {
            // If already joined, just select it
            onSelectPledge(pledge);
            return;
        }

        if (!user) {
            alert("Please sign in to join a community pledge!");
            return;
        }
        try {
            setOperationLoading(true);
            await communityService.joinPledge(pledge, user, isJoined);
            // Context listener will auto-update state
            await refresh(); // Manual refresh to ensure sync (esp for mock mode)
            onSelectPledge(pledge);
        } catch (error) {
            console.error("Join failed", error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to join pledge: ${errorMessage}`);
        } finally {
            setOperationLoading(false);
        }
    };

    // Granular error state for the form specifically
    const [creationError, setCreationError] = useState<string | null>(null);

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    const handleCreate = async (pledgeData: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>) => {
        if (!user) {
            setSnackbar({ open: true, message: "Please sign in to create a pledge!", severity: 'error' });
            return;
        }

        try {
            setOperationLoading(true);
            setCreationError(null); // Reset error

            const newPledge = await communityService.createPledge(pledgeData, user);

            // Success!
            setShowCreateForm(false);
            // Success!
            setShowCreateForm(false);
            await refresh();
            onSelectPledge(newPledge); // Auto-join
            setSnackbar({ open: true, message: "Pledge created successfully!", severity: 'success' });

            // Navigate back after a brief moment or immediately? 
            // The user said "close the dialog", which we did. 
            // onBack(); // Removing onBack so they stay in community view to see it? Or keep it?
            // User flow: Create -> Dialog Closes -> User is taken to Counter (via onSelectPledge)
            // onSelectPledge usually changes view to 'counter'. 
            // AND we should probably close the community view if onSelectPledge handles navigation.
            // But let's keep onBack() if that was the intended flow, or remove if onSelectPledge does the job.
            // onSelectPledge logic in App.tsx: sets activePledge and view='counter'.
            // So onBack() (which goes to 'counter' or 'home') is redundant if we already switch views.
            // Let's remove onBack() to rely on onSelectPledge, BUT onBack() was previously called.
            // If onSelectPledge switches view, CommunityView unmounts anyway.

        } catch (error) {
            console.error("Create failed", error);
            const msg = error instanceof Error ? error.message : "Failed to create pledge.";
            // Set granular error for the form to display
            setCreationError(msg);
            // Do NOT close form on error so they can fix it
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDelete = async (pledge: Pledge) => {
        if (!user) return;
        if (window.confirm(`Are you sure you want to delete "${pledge.title}"? This cannot be undone.`)) {
            try {
                setOperationLoading(true);
                await communityService.deletePledge(pledge.id, user.uid);
                setSnackbar({ open: true, message: "Cause deleted successfully.", severity: 'success' });
                await refresh();
            } catch (error) {
                console.error("Delete failed", error);
                setSnackbar({ open: true, message: "Failed to delete cause.", severity: 'error' });
            } finally {
                setOperationLoading(false);
            }
        }
    };

    const handleEdit = (pledge: Pledge) => {
        setEditingPledge(pledge);
        setShowCreateForm(true);
    };

    const handleUpdate = async (pledgeData: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>) => {
        if (!user || !editingPledge) return;

        try {
            setOperationLoading(true);
            setCreationError(null);

            await communityService.updatePledge(editingPledge.id, pledgeData, user.uid);

            setShowCreateForm(false);
            setEditingPledge(null);
            setSnackbar({ open: true, message: "Cause updated successfully!", severity: 'success' });
            await refresh();
        } catch (error) {
            console.error("Update failed", error);
            const msg = error instanceof Error ? error.message : "Failed to update pledge.";
            setCreationError(msg);
        } finally {
            setOperationLoading(false);
        }
    };



    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
                <Toolbar>
                    <IconButton edge="start" onClick={onBack} aria-label="back" sx={{ mr: 2 }}>
                        <ArrowLeft />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Globe2 size={24} color="#EA580C" />
                        Community
                    </Typography>
                    {user && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<Plus size={18} />}
                            onClick={() => setShowCreateForm(true)}
                            size="small"
                            sx={{ borderRadius: 4 }}
                        >
                            Start Cause
                        </Button>
                    )}
                </Toolbar>
            </AppBar>

            <Container maxWidth="md" sx={{ flex: 1, overflowY: 'auto', py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress color="primary" />
                    </Box>
                ) : (
                    pledges.map(pledge => {
                        const isJoined = myPledges.some(p => p.pledgeId === pledge.id);
                        return (
                            <PledgeCard
                                key={pledge.id}
                                pledge={pledge}
                                isJoined={isJoined}
                                onJoin={(p) => handleJoin(p, isJoined)}
                                canManage={user?.uid === pledge.creatorId}
                                onDelete={handleDelete}
                                onEdit={handleEdit}
                            />
                        );
                    })
                )}
            </Container>

            <Dialog
                open={showCreateForm}
                onClose={() => {
                    setShowCreateForm(false);
                    setEditingPledge(null);
                }}
                fullWidth
                maxWidth="sm"
            >
                <PledgeForm
                    onClose={() => {
                        setShowCreateForm(false);
                        setEditingPledge(null);
                    }}
                    onSubmit={editingPledge ? handleUpdate : handleCreate}
                    loading={operationLoading}
                    serverError={creationError}
                    initialData={editingPledge || undefined}
                    isEditing={!!editingPledge}
                />
            </Dialog>

            {/* Notification Snackbar */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
};
