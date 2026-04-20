import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Flame, Plus, Trophy } from 'lucide-react';
import { PersonalPledge, Pledge } from '../types/pledge';
import { personalPledgeService } from '../services/personalPledgeService';
import { pledgeService } from '../services/pledgeService';
import { PledgeCard } from './PledgeCard';
import { PledgeForm } from './PledgeForm';
import { useCommunity } from '../contexts/CommunityContext';
import { useAuth } from '../contexts/AuthContext';
import {
    Box,
    AppBar,
    Toolbar,
    Typography,
    Container,
    CircularProgress,
    Dialog,
    Snackbar,
    Alert,
    Tabs,
    Tab,
    Fab,
    TextField,
    Button,
    Paper
} from '@mui/material';

interface PledgesViewProps {
    onSelectPledge: (pledge: Pledge) => void;
    onSelectPersonalPledge: (pledge: PersonalPledge) => void;
    completedPledge?: PersonalPledge | null;
    onCelebrationDismiss?: () => void;
}

interface ContributeDialogState {
    open: boolean;
    pledge: PersonalPledge | null;
    malas: string;
}

export const PledgesView: React.FC<PledgesViewProps> = ({ onSelectPledge, onSelectPersonalPledge, completedPledge, onCelebrationDismiss }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { myPledges, refresh: refreshCommunityPledges } = useCommunity();

    const [tab, setTab] = useState(0);
    const [personalPledges, setPersonalPledges] = useState<PersonalPledge[]>([]);
    const [personalLoading, setPersonalLoading] = useState(true);
    const [operationLoading, setOperationLoading] = useState(false);

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingPledge, setEditingPledge] = useState<PersonalPledge | null>(null);
    const [creationError, setCreationError] = useState<string | null>(null);

    const [contributeDialog, setContributeDialog] = useState<ContributeDialogState>({
        open: false,
        pledge: null,
        malas: ''
    });

    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });

    // Celebration dialog — set from manual contribute or from counter via props
    const [celebration, setCelebration] = useState<PersonalPledge | null>(null);

    const loadPersonalPledges = useCallback(async () => {
        if (!user) { setPersonalLoading(false); return; }
        try {
            setPersonalLoading(true);
            const pledges = await personalPledgeService.getPersonalPledges(user.uid);
            setPersonalPledges(pledges);
        } catch (err) {
            console.error("Failed to load personal pledges", err);
        } finally {
            setPersonalLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadPersonalPledges();
    }, [loadPersonalPledges]);

    useEffect(() => {
        if (completedPledge) {
            loadPersonalPledges();
            setCelebration(completedPledge);
        }
    }, [completedPledge, loadPersonalPledges]);

    // --- Personal Pledge Handlers ---

    const handleCreatePersonal = async (data: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>) => {
        if (!user) return;
        try {
            setOperationLoading(true);
            setCreationError(null);
            await personalPledgeService.createPersonalPledge(user.uid, {
                title: data.title,
                description: data.description || '',
                targetMalas: data.targetMalas,
                mantra: data.mantra
            });
            setShowCreateForm(false);
            setSnackbar({ open: true, message: "Personal pledge created!", severity: 'success' });
            await loadPersonalPledges();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to create pledge.";
            setCreationError(msg);
        } finally {
            setOperationLoading(false);
        }
    };

    const handleUpdatePersonal = async (data: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>) => {
        if (!user || !editingPledge) return;
        try {
            setOperationLoading(true);
            setCreationError(null);
            await personalPledgeService.updatePersonalPledge(user.uid, editingPledge.id, {
                title: data.title,
                description: data.description || '',
                targetMalas: data.targetMalas,
                mantra: data.mantra
            });
            setShowCreateForm(false);
            setEditingPledge(null);
            setSnackbar({ open: true, message: "Pledge updated!", severity: 'success' });
            await loadPersonalPledges();
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to update pledge.";
            setCreationError(msg);
        } finally {
            setOperationLoading(false);
        }
    };

    const handleDeletePersonal = async (pledge: PersonalPledge) => {
        if (!user) return;
        if (!window.confirm(`Delete "${pledge.title}"? This cannot be undone.`)) return;
        try {
            setOperationLoading(true);
            await personalPledgeService.deletePersonalPledge(user.uid, pledge.id);
            setSnackbar({ open: true, message: "Pledge deleted.", severity: 'success' });
            await loadPersonalPledges();
        } catch (err) {
            setSnackbar({ open: true, message: "Failed to delete pledge.", severity: 'error' });
        } finally {
            setOperationLoading(false);
        }
    };

    const handleContribute = async () => {
        if (!user || !contributeDialog.pledge) return;
        const malas = parseInt(contributeDialog.malas);
        if (isNaN(malas) || malas <= 0) return;
        const pledgeSnapshot = contributeDialog.pledge;
        const willComplete = pledgeSnapshot.currentMalas + malas >= pledgeSnapshot.targetMalas;
        try {
            setOperationLoading(true);
            await personalPledgeService.contributeToPersonalPledge(user.uid, pledgeSnapshot.id, malas);
            setContributeDialog({ open: false, pledge: null, malas: '' });
            await loadPersonalPledges();
            if (willComplete) {
                setCelebration(pledgeSnapshot);
            } else {
                setSnackbar({ open: true, message: `${malas} malas added!`, severity: 'success' });
            }
        } catch (err) {
            setSnackbar({ open: true, message: "Failed to record contribution.", severity: 'error' });
        } finally {
            setOperationLoading(false);
        }
    };

    // --- Community Pledge Handlers ---

    const handleCelebrationDelete = async () => {
        if (!user || !celebration) return;
        try {
            await personalPledgeService.deletePersonalPledge(user.uid, celebration.id);
            setCelebration(null);
            onCelebrationDismiss?.();
            await loadPersonalPledges();
        } catch (err) {
            setSnackbar({ open: true, message: "Failed to delete pledge.", severity: 'error' });
        }
    };

    const handleCelebrationKeep = () => {
        setCelebration(null);
        onCelebrationDismiss?.();
    };

    const handleLeaveCommunityPledge = async (pledge: Pledge) => {
        if (!user) return;
        try {
            setOperationLoading(true);
            await pledgeService.leavePledge(pledge.id, user.uid);
            await refreshCommunityPledges();
            setSnackbar({ open: true, message: "Left pledge.", severity: 'success' });
        } catch (err) {
            setSnackbar({ open: true, message: "Failed to leave pledge.", severity: 'error' });
        } finally {
            setOperationLoading(false);
        }
    };

    const toPledge = (mp: typeof myPledges[0]): Pledge => ({
        id: mp.pledgeId,
        title: mp.pledgeTitle,
        description: '',
        targetMalas: mp.pledgeTarget,
        currentMalas: mp.contributedMalas,
        participants: 0
    });

    const toPersonalAsPledge = (p: PersonalPledge): Pledge => ({
        id: p.id,
        title: p.title,
        description: p.description || '',
        targetMalas: p.targetMalas,
        currentMalas: p.currentMalas,
        participants: 0,
        mantra: p.mantra
    });

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <AppBar position="sticky" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Flame size={24} color="#EA580C" />
                        {t('nav.pledges')}
                    </Typography>
                </Toolbar>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    textColor="primary"
                    indicatorColor="primary"
                    variant="fullWidth"
                >
                    <Tab label={t('pledge.personalTab')} />
                    <Tab label={t('pledge.communityTab')} />
                </Tabs>
            </AppBar>

            {/* Personal Tab */}
            {tab === 0 && (
                <Container maxWidth="md" sx={{ flex: 1, overflowY: 'auto', py: 3, display: 'flex', flexDirection: 'column', gap: 2, pb: 10 }}>
                    {personalLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                            <CircularProgress color="primary" />
                        </Box>
                    ) : personalPledges.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                            <Typography variant="body1" color="text.secondary">
                                {t('pledge.noPledgesYet')}
                            </Typography>
                        </Paper>
                    ) : (
                        personalPledges.map(p => (
                            <PledgeCard
                                key={p.id}
                                pledge={toPersonalAsPledge(p)}
                                isJoined={true}
                                variant="personal"
                                onJoin={() => {}}
                                onContribute={() => setContributeDialog({ open: true, pledge: p, malas: '' })}
                                onEdit={() => { setEditingPledge(p); setShowCreateForm(true); }}
                                onDelete={() => handleDeletePersonal(p)}
                            />
                        ))
                    )}

                    {user && (
                        <Fab
                            color="primary"
                            aria-label={t('pledge.newPersonalPledge')}
                            onClick={() => { setEditingPledge(null); setShowCreateForm(true); }}
                            sx={{ position: 'fixed', bottom: 100, right: 24 }}
                        >
                            <Plus size={24} />
                        </Fab>
                    )}
                </Container>
            )}

            {/* Community Tab */}
            {tab === 1 && (
                <Container maxWidth="md" sx={{ flex: 1, overflowY: 'auto', py: 3, display: 'flex', flexDirection: 'column', gap: 2, pb: 10 }}>
                    {myPledges.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                            <Typography variant="body1" color="text.secondary">
                                {t('pledge.noJoinedPledges')}
                            </Typography>
                        </Paper>
                    ) : (
                        myPledges.map(mp => {
                            const pledge = toPledge(mp);
                            return (
                                <PledgeCard
                                    key={mp.id}
                                    pledge={pledge}
                                    isJoined={true}
                                    variant="community"
                                    onJoin={(p) => onSelectPledge(p)}
                                    onLeave={(p) => handleLeaveCommunityPledge(p)}
                                    myContribution={mp.contributedMalas}
                                />
                            );
                        })
                    )}
                </Container>
            )}

            {/* Create / Edit Dialog */}
            <Dialog
                open={showCreateForm}
                onClose={() => { setShowCreateForm(false); setEditingPledge(null); setCreationError(null); }}
                fullWidth
                maxWidth="sm"
            >
                <PledgeForm
                    onClose={() => { setShowCreateForm(false); setEditingPledge(null); setCreationError(null); }}
                    onSubmit={editingPledge ? handleUpdatePersonal : handleCreatePersonal}
                    loading={operationLoading}
                    serverError={creationError}
                    initialData={editingPledge ? toPersonalAsPledge(editingPledge) : undefined}
                    isEditing={!!editingPledge}
                />
            </Dialog>

            {/* Contribute Dialog */}
            <Dialog
                open={contributeDialog.open}
                onClose={() => setContributeDialog({ open: false, pledge: null, malas: '' })}
                maxWidth="xs"
                fullWidth
            >
                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6">{t('pledge.contribute')}</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {contributeDialog.pledge?.title}
                    </Typography>

                    {/* Option 1: Go to counter */}
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        size="large"
                        onClick={() => {
                            if (contributeDialog.pledge) {
                                setContributeDialog({ open: false, pledge: null, malas: '' });
                                onSelectPersonalPledge(contributeDialog.pledge);
                            }
                        }}
                        sx={{ py: 1.5 }}
                    >
                        {t('pledge.continueChanting')}
                    </Button>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                        <Typography variant="caption" color="text.secondary">or log manually</Typography>
                        <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                    </Box>

                    {/* Option 2: Manual entry */}
                    <TextField
                        type="number"
                        label={t('pledge.malas')}
                        value={contributeDialog.malas}
                        onChange={(e) => setContributeDialog(prev => ({ ...prev, malas: e.target.value }))}
                        fullWidth
                        inputProps={{ min: 1 }}
                        placeholder={t('pledge.contributeMalas')}
                    />
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                        <Button onClick={() => setContributeDialog({ open: false, pledge: null, malas: '' })} color="inherit">
                            Cancel
                        </Button>
                        <Button
                            onClick={handleContribute}
                            variant="outlined"
                            color="primary"
                            disabled={operationLoading || !contributeDialog.malas || parseInt(contributeDialog.malas) <= 0}
                        >
                            {operationLoading ? 'Saving...' : 'Log Malas'}
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Celebration Dialog */}
            <Dialog
                open={!!celebration}
                onClose={handleCelebrationKeep}
                maxWidth="xs"
                fullWidth
                PaperProps={{ sx: { borderRadius: 4, overflow: 'visible' } }}
            >
                <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
                    <Box sx={{
                        width: 72, height: 72, borderRadius: '50%',
                        bgcolor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 0 8px rgba(251,191,36,0.15)'
                    }}>
                        <Trophy size={36} color="#D97706" />
                    </Box>
                    <Typography variant="h5" fontWeight="bold" sx={{ color: 'primary.dark' }}>
                        Pledge Complete! 🎉
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        You fulfilled your pledge:
                    </Typography>
                    <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 700 }}>
                        "{celebration?.title}"
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {celebration?.targetMalas} malas completed. Well done! 🙏
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, width: '100%', mt: 1 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            color="error"
                            onClick={handleCelebrationDelete}
                        >
                            Delete Pledge
                        </Button>
                        <Button
                            fullWidth
                            variant="contained"
                            color="primary"
                            onClick={handleCelebrationKeep}
                        >
                            Keep It
                        </Button>
                    </Box>
                </Box>
            </Dialog>
        </Box>
    );
};
