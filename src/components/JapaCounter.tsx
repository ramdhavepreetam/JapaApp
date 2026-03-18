import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, RotateCcw, History, Sparkles, Target, Users, Play, Pause, RotateCw, WifiOff, Wifi } from 'lucide-react';
import { storage, StorageSchema, PendingSyncItem, getTodayDate } from '../lib/storage';
import { BeadRing } from './BeadRing';
import { Pledge } from '../types/pledge';
import { Box, IconButton, Button, Typography, Chip, useTheme, Zoom, LinearProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { userService } from '../services/userService';

interface JapaCounterProps {
    onViewReport: () => void;

    // Legacy support
    activePledge?: Pledge | null;

    // New Props
    mode?: 'personal' | 'pledge' | 'community';
    contextId?: string; // pledgeId or communityId
    onSaved?: (malas: number, mantras: number) => void;
    mantra?: string;
}

export const JapaCounter: React.FC<JapaCounterProps> = ({
    activePledge,
    onViewReport,
    mode = activePledge ? 'pledge' : 'personal',
    contextId = activePledge?.id,
    onSaved,
    mantra = activePledge?.mantra
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { myPledges, refresh: refreshPledges } = useCommunity();
    const [data, setData] = useState<StorageSchema>(storage.get());
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [mantraFontSize, setMantraFontSize] = useState<number>(() => {
        const saved = localStorage.getItem('japa_mantra_font_size');
        return saved ? parseInt(saved, 10) : 24;
    });
    const theme = useTheme();

    const handleFontSizeChange = (e: React.MouseEvent, change: number) => {
        e.stopPropagation();
        setMantraFontSize(prev => {
            const newSize = Math.max(14, Math.min(48, prev + change));
            localStorage.setItem('japa_mantra_font_size', newSize.toString());
            return newSize;
        });
    };

    // Community Contribution Logic (Only for Pledge Mode currently used here, Community Mode passed down via tab)
    // For Community Mode, we might want to fetch my contribution to *that* community specifically?
    // Leaving existing logic for Pledge mode backward compat.
    const myContribution = (mode === 'pledge' && activePledge)
        ? myPledges.find(p => p.pledgeId === activePledge.id)?.contributedMalas || 0
        : 0;

    useEffect(() => {
        setData(storage.get());
    }, []);

    // On mount, silently restore totalMalas from Firestore if it's higher than localStorage.
    // Protects against: browser storage clear, iOS Safari 7-day ITP purge, new device.
    // Only runs once per login session. Never overwrites local data with a lower value.
    useEffect(() => {
        if (!user) return;
        userService.getUserProfile(user.uid).then(profile => {
            if (!profile) return;
            const firestoreMalas = profile.stats?.totalMalas || 0;
            const local = storage.get();
            if (firestoreMalas > local.totalMalas) {
                const updated = storage.get();
                updated.totalMalas = firestoreMalas;
                storage.save(updated);
                setData(storage.get());
            }
        }).catch(() => {}); // silent — never disrupts the counter
    }, [user]);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const syncPending = useCallback(async () => {
        if (!user || !navigator.onLine) return;
        const current = storage.get();
        for (const item of current.pendingSync) {
            try {
                await userService.updateUserStats(user.uid, item.malas, item.counts);
                storage.dequeueSync(item.id);
            } catch (e) {
                console.error('Failed to sync session item', e);
                break;
            }
        }
        setData(storage.get());
    }, [user]);

    const queueSync = useCallback((counts: number, malas: number) => {
        if (counts <= 0 && malas <= 0) return;
        const item: PendingSyncItem = {
            id: `sync_${Date.now()}`,
            createdAt: new Date().toISOString(),
            counts,
            malas,
            completed: false
        };
        storage.enqueueSync(item);
        setData(storage.get());
    }, []);

    useEffect(() => {
        if (isOnline) {
            syncPending();
        }
    }, [isOnline, syncPending]);

    const playClickSound = () => {
        if (!soundEnabled) return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const triggerHaptic = (duration: number = 15) => {
        if (navigator.vibrate) {
            navigator.vibrate(duration);
            return;
        }
        try {
            const label = document.getElementById('ios-haptic-label');
            if (label) label.click();
        } catch (e) { }
    };

    const submitCommunityEntry = async (malas: number, mantras: number) => {
        if (!user || !contextId) return;

        // Dynamic import to avoid circular dep if any (safeguard)
        const { communityJapaService } = await import('../services/communityJapaService');
        const { Timestamp } = await import('firebase/firestore');

        const entryId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const entry = {
            id: entryId,
            userId: user.uid,
            communityId: contextId,
            malas,
            mantras,
            timestamp: Timestamp.now()
        };

        try {
            await communityJapaService.submitJapaEntry(contextId, entry);
            if (onSaved) onSaved(malas, mantras);
        } catch (e) {
            console.error("Failed to submit community entry", e);
            // It should have been queued by the service if offline, so this acts as generic error trap
        }
    };

    const handleTap = async () => {
        // Prevent interaction if session not active/paused logic is desired
        if (!data.session.active) {
            setFeedback(t('counter.startPrompt'));
            setTimeout(() => setFeedback(null), 2000);
            return;
        }
        if (data.session.paused) {
            setFeedback(t('counter.paused'));
            setTimeout(() => setFeedback(null), 2000);
            return;
        }

        triggerHaptic(15);
        playClickSound();

        const result = storage.increment();
        setData({ ...result.newData });

        if (result.malaCompleted) {
            triggerHaptic(400);

            const msg = mode === 'community' ? t('counter.malaOffered')
                : mode === 'pledge' ? t('counter.contributionSent')
                    : t('counter.malaCompleted');

            setFeedback(msg);
            setTimeout(() => setFeedback(null), 3000);

            if (user) {
                // 1. Community Mode
                if (mode === 'community' && contextId) {
                    await submitCommunityEntry(1, 108);
                }
                // 2. Pledge Mode
                else if (mode === 'pledge' && contextId) {
                    import('../services/pledgeService').then(({ pledgeService: communityService }) => {
                        communityService.contribute(contextId!, user.uid, 1)
                            .then(() => {
                                // Re-fetch pledges & myPledges so UI updates
                                // (onSnapshot may be dead in mock/offline mode)
                                refreshPledges();
                            })
                            .catch((err: unknown) => console.error('Pledge contribute failed', err));
                    });
                    // Pledges also update personal stats separately
                    userService.updateUserStats(user.uid, 1, 108).catch(() => queueSync(108, 1));
                }
                // 3. Personal Mode
                else {
                    userService.updateUserStats(user.uid, 1, 108).catch(() => queueSync(108, 1));
                }
            }
        }
    };

    // ... Controls (Reset/Start/Pause) ...
    // Note: Re-implementing simplified controllers for brevity as the logic is identical
    const handleReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Reset today's progress?")) { setData({ ...storage.resetToday() }); }
    };
    const handleStartSession = () => { setData({ ...storage.startSession() }); setFeedback(t('counter.startSession')); setTimeout(() => setFeedback(null), 2000); };
    const handlePauseSession = () => { setData({ ...storage.pauseSession() }); setFeedback(t('counter.paused')); setTimeout(() => setFeedback(null), 2000); };
    const handleResumeSession = () => { setData({ ...storage.resumeSession() }); setFeedback(t('counter.resume')); setTimeout(() => setFeedback(null), 2000); };

    const handleResetSession = async () => {
        if (!data.session.active && data.session.counts === 0) return;
        if (!confirm("Reset this session? Your session progress will be saved.")) return;

        // If ending session, we might want to save progress?
        // Existing logic enqued sync. 
        // For Community Mode, we should probably submit the partial session?
        // The prompt says "When a mala completes or user saves". This is "Reset" which users effectively use as "Save & End".

        const leftoverCounts = data.session.counts % 108;

        if (leftoverCounts > 0 && user) {
            if (mode === 'community' && contextId) {
                // Submit session totals
                await submitCommunityEntry(0, leftoverCounts);
            } else {
                // Personal/Pledge queue logic
                const item: PendingSyncItem = {
                    id: `session_${Date.now()}`,
                    createdAt: new Date().toISOString(),
                    counts: leftoverCounts,
                    malas: 0,
                    completed: true
                };
                storage.enqueueSync(item);
            }
        }

        setData({ ...storage.resetSession() });
        setFeedback("Session saved & reset");
        setTimeout(() => setFeedback(null), 2000);
        if (mode !== 'community') syncPending();
    };


    return (
        <Box
            sx={{
                height: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                cursor: 'pointer',
                userSelect: 'none',
                touchAction: 'manipulation'
            }}
            onClick={handleTap}
        >
            {/* Header / Top Bar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2, pr: 8, py: 2, zIndex: 10, pointerEvents: 'none' }}>
                <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
                    <IconButton
                        onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); }}
                        color="primary"
                        sx={{ bgcolor: 'rgba(234, 88, 12, 0.1)', '&:hover': { bgcolor: 'rgba(234, 88, 12, 0.2)' } }}
                    >
                        {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                    </IconButton>
                    <IconButton
                        onClick={handleReset}
                        color="secondary"
                        sx={{ bgcolor: 'rgba(136, 19, 55, 0.1)', '&:hover': { bgcolor: 'rgba(136, 19, 55, 0.2)' } }}
                    >
                        <RotateCcw size={24} />
                    </IconButton>
                </Box>

                <Box sx={{ pointerEvents: 'auto' }}>
                    <Button
                        onClick={(e) => { e.stopPropagation(); onViewReport(); }}
                        variant="outlined"
                        color="primary"
                        startIcon={<History size={20} />}
                        sx={{ borderRadius: 28, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                        {t('counter.history')}
                    </Button>
                </Box>
            </Box>

            {/* Main Center Content */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', p: 2 }}>

                <Box sx={{ position: 'absolute', top: 88, left: 16, display: 'flex', gap: 1, zIndex: 6 }}>
                    <Chip
                        icon={isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        label={isOnline ? t('counter.online') : t('counter.offline')}
                        size="small"
                        sx={{ bgcolor: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isOnline ? '#047857' : '#b91c1c' }}
                    />
                    {data.pendingSync.length > 0 && mode !== 'community' && (
                        <Chip
                            label={`${data.pendingSync.length} pending`}
                            size="small"
                            sx={{ bgcolor: 'rgba(234, 88, 12, 0.12)', color: 'primary.dark' }}
                        />
                    )}
                </Box>

                {/* Mode Specific Badges */}
                {mode === 'pledge' && activePledge && (
                    <Box sx={{ position: 'absolute', top: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 5 }}>
                        <Zoom in={true}>
                            <Chip
                                icon={<Sparkles size={14} color={theme.palette.background.paper} />}
                                label={`Contributing to: ${activePledge.title}`}
                                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', boxShadow: 3, fontWeight: 700 }}
                            />
                        </Zoom>
                        <Box sx={{ display: 'flex', gap: 2, bgcolor: 'rgba(255,255,255,0.9)', px: 2, py: 0.5, borderRadius: 4, boxShadow: 1 }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: 'primary.dark' }}>
                                <Target size={14} /> My Total: {myContribution}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                <Users size={14} /> {activePledge.participants} Joined
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* Community Mode overlay handled by parent usually, but good to have indicator if standalone */}

                {/* Mantra Display */}
                {mantra && (
                    <Box sx={{
                        position: 'relative',
                        mt: 8, // Added to prevent overlap with the badges above
                        mb: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        maxWidth: 360,
                        minHeight: 80, // Reserve space to prevent layout shift
                        pointerEvents: 'auto'
                    }}>
                        <Typography
                            variant="body1"
                            sx={{
                                fontSize: `${mantraFontSize}px`,
                                fontFamily: theme.typography.fontFamily,
                                fontStyle: 'italic',
                                fontWeight: 500,
                                color: 'primary.main',
                                textAlign: 'center',
                                transition: 'font-size 0.2s ease-in-out',
                                px: 2
                            }}
                        >
                            "{mantra}"
                        </Typography>

                        {/* Font Size Controls */}
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, opacity: 0.5, '&:hover': { opacity: 1 }, transition: 'opacity 0.2s' }}>
                            <Button 
                                size="small" 
                                onClick={(e) => handleFontSizeChange(e, -2)}
                                disabled={mantraFontSize <= 14}
                                sx={{ minWidth: 'auto', p: 0.5 }}
                            >
                                A-
                            </Button>
                            <Button 
                                size="small" 
                                onClick={(e) => handleFontSizeChange(e, 2)}
                                disabled={mantraFontSize >= 48}
                                sx={{ minWidth: 'auto', p: 0.5 }}
                            >
                                A+
                            </Button>
                        </Box>
                    </Box>
                )}

                <BeadRing count={data.currentCount} />

                <Box sx={{ mt: 1, width: '100%', maxWidth: 320 }}>
                    <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (data.currentCount / 108) * 100)}
                        sx={{ height: 8, borderRadius: 6, bgcolor: 'action.hover' }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                        {data.currentCount} / 108 beads
                    </Typography>
                </Box>

                <Box sx={{ mt: 1, display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                    {/* Today's malas */}
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                            {t('counter.today')}
                        </Typography>
                        <Typography variant="h3" color="primary.main" sx={{ lineHeight: 1 }}>
                            {data.history[getTodayDate()]?.malas || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{t('counter.malas')}</Typography>
                    </Box>

                    {/* Divider */}
                    <Box sx={{ width: '1px', height: 56, bgcolor: 'divider' }} />

                    {/* Lifetime malas — uses totalMalas which never resets */}
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                            {t('counter.lifetime')}
                        </Typography>
                        <Typography variant="h3" color="secondary.main" sx={{ lineHeight: 1 }}>
                            {data.totalMalas}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{t('counter.malas')}</Typography>
                    </Box>
                </Box>

                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            style={{
                                position: 'absolute', bottom: 80,
                                backgroundColor: theme.palette.primary.main, color: theme.palette.primary.contrastText,
                                padding: '12px 32px', borderRadius: 16, boxShadow: '0 8px 32px rgba(234, 88, 12, 0.3)'
                            }}
                        >
                            <Typography variant="h6">{feedback}</Typography>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {/* Controls */}
            <Box sx={{ p: 2, textAlign: 'center', pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                    {!data.session.active ? (
                        <Button
                            variant="contained" color="primary" startIcon={<Play size={18} />}
                            onClick={(e) => { e.stopPropagation(); handleStartSession(); }}
                            sx={{ borderRadius: 8, px: 4 }}
                        >
                            {t('counter.startSession')}
                        </Button>
                    ) : (
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {data.session.paused ? (
                                <Button
                                    variant="contained" color="primary" startIcon={<Play size={18} />}
                                    onClick={(e) => { e.stopPropagation(); handleResumeSession(); }}
                                >
                                    {t('counter.resume')}
                                </Button>
                            ) : (
                                <Button
                                    variant="outlined" color="secondary" startIcon={<Pause size={18} />}
                                    onClick={(e) => { e.stopPropagation(); handlePauseSession(); }}
                                >
                                    {t('counter.pause')}
                                </Button>
                            )}
                            <Button
                                variant="outlined" color="error" startIcon={<RotateCw size={18} />}
                                onClick={(e) => { e.stopPropagation(); handleResetSession(); }}
                            >
                                {t('counter.resetSession')}
                            </Button>
                        </Box>
                    )}

                    <Button
                        variant="contained" color="secondary"
                        onClick={(e) => { e.stopPropagation(); handleTap(); }}
                        disabled={!data.session.active || data.session.paused}
                        sx={{ borderRadius: 8, px: 4 }}
                    >
                        {t('counter.addChant')}
                    </Button>

                    <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7, fontStyle: 'italic' }}>
                        {data.session.active ? t('counter.sessionTotal', { malas: data.session.malas }) : t('counter.startPrompt')}
                    </Typography>
                </Box>
            </Box>

            {/* iOS Haptic Workaround */}
            <div style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }} onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" id="ios-haptic-switch" style={{ display: 'none' }} />
                {/* @ts-ignore */}
                <input type="checkbox" switch="true" id="ios-haptic-switch-trigger" style={{ display: 'none' }} />
                <label htmlFor="ios-haptic-switch-trigger" id="ios-haptic-label">Haptic</label>
            </div>
        </Box>
    );
};
