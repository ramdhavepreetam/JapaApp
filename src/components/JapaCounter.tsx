import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, RotateCcw, History, Sparkles, Target, Users, Play, Pause, RotateCw, WifiOff, Wifi } from 'lucide-react';
import { storage, StorageSchema, PendingSyncItem } from '../lib/storage';
import { BeadRing } from './BeadRing';
import { Pledge } from '../services/community';
import { Box, IconButton, Button, Typography, Chip, useTheme, Zoom, LinearProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { userService } from '../services/userService';

interface JapaCounterProps {
    onViewReport: () => void;
    activePledge?: Pledge | null;
}

export const JapaCounter: React.FC<JapaCounterProps> = ({ activePledge, onViewReport }) => {
    const { user } = useAuth();
    const { myPledges } = useCommunity();
    const [data, setData] = useState<StorageSchema>(storage.get());
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const theme = useTheme();

    const myContribution = activePledge
        ? myPledges.find(p => p.pledgeId === activePledge.id)?.contributedMalas || 0
        : 0;

    useEffect(() => {
        // Sync local state with storage on mount
        setData(storage.get());
    }, []);

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

    // ... (rest of audio logic unchanged) ...
    // Note: I will use a larger context to ensure I don't break the file structure, 
    // but the actual edit is inserting `myContribution` calculation and the UI elements.
    // For safety, I'll return the modified Component body parts.

    const playClickSound = () => {
        if (!soundEnabled) return;
        try {
            // Using a brighter, more spiritual mock sound freq if we had real audio
            // For now, same simple oscillator
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 - Higher pitch
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const triggerHaptic = (duration: number = 15) => {
        // 1. Standard Web Vibration API (Android/Desktop)
        if (navigator.vibrate) {
            navigator.vibrate(duration);
            return;
        }

        // 2. iOS "Switch Hack" (iOS 18+)
        // Triggers a light impact haptic by toggling a switch control
        try {
            const label = document.getElementById('ios-haptic-label');
            if (label) {
                label.click();
            }
        } catch (e) {
            // Ignore errors
        }
    };

    const handleTap = () => {
        if (!data.session.active) {
            setFeedback("Start a session to begin 🙏");
            setTimeout(() => setFeedback(null), 2000);
            return;
        }
        if (data.session.paused) {
            setFeedback("Session paused");
            setTimeout(() => setFeedback(null), 2000);
            return;
        }
        // Haptic Feedback
        triggerHaptic(15);
        playClickSound();

        const result = storage.increment();
        setData({ ...result.newData });

        if (result.malaCompleted) {
            triggerHaptic(400); // For iOS this will just be a single tick, but better than nothing
            if (navigator.vibrate) navigator.vibrate(400); // Redundant if triggerHaptic handles it, but safety

            setFeedback("Mala Completed! 🕉️");
            setTimeout(() => setFeedback(null), 3000);

            // Auto-contribute if active pledge
            if (activePledge && user) {
                // Using dynamic import to avoid circular dependency loop
                import('../services/community').then(({ communityService }) => {
                    communityService.contribute(activePledge.id, user.uid, 1);
                });
            }

            // Update Personal Stats (Streak) - Always run if logged in
            if (user) {
                if (navigator.onLine) {
                    userService.updateUserStats(user.uid, 1, 108).catch(() => {
                        queueSync(108, 1);
                    });
                } else {
                    queueSync(108, 1);
                }
            }

            setTimeout(() => {
                setFeedback(activePledge ? "Contribution Sent! 🚩" : "Mala Recorded! 📿");
                setTimeout(() => setFeedback(null), 3000);
            }, 1500);

        }
    }
    const handleReset = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm("Reset today's progress?")) {
            const newData = storage.resetToday();
            setData({ ...newData });
        }
    };

    const handleStartSession = () => {
        const newData = storage.startSession();
        setData({ ...newData });
        setFeedback("Session started");
        setTimeout(() => setFeedback(null), 2000);
    };

    const handlePauseSession = () => {
        const newData = storage.pauseSession();
        setData({ ...newData });
        setFeedback("Session paused");
        setTimeout(() => setFeedback(null), 2000);
    };

    const handleResumeSession = () => {
        const newData = storage.resumeSession();
        setData({ ...newData });
        setFeedback("Session resumed");
        setTimeout(() => setFeedback(null), 2000);
    };

    const handleResetSession = () => {
        if (!data.session.active && data.session.counts === 0) return;
        if (!confirm("Reset this session? Your session progress will be saved for sync if you're signed in.")) return;

        const item: PendingSyncItem = {
            id: `session_${Date.now()}`,
            createdAt: new Date().toISOString(),
            counts: data.session.counts,
            malas: data.session.malas,
            completed: true
        };

        if (item.counts > 0 || item.malas > 0) {
            storage.enqueueSync(item);
        }

        const newData = storage.resetSession();
        setData({ ...newData });
        setFeedback("Session reset");
        setTimeout(() => setFeedback(null), 2000);
        syncPending();
    };

    const toggleSound = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSoundEnabled(!soundEnabled);
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
                touchAction: 'manipulation' // Prevents double-tap zoom
            }}
            onClick={handleTap}
        >
            {/* Header / Top Bar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, zIndex: 10, pointerEvents: 'none' }}>
                <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
                    <IconButton
                        onClick={toggleSound}
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
                        History
                    </Button>
                </Box>
            </Box>

            {/* Main Center Content */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', p: 2 }}>

                <Box sx={{ position: 'absolute', top: 88, left: 16, display: 'flex', gap: 1, zIndex: 6 }}>
                    <Chip
                        icon={isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                        label={isOnline ? 'Online' : 'Offline'}
                        size="small"
                        sx={{ bgcolor: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: isOnline ? '#047857' : '#b91c1c' }}
                    />
                    {data.pendingSync.length > 0 && (
                        <Chip
                            label={`${data.pendingSync.length} pending`}
                            size="small"
                            sx={{ bgcolor: 'rgba(234, 88, 12, 0.12)', color: 'primary.dark' }}
                        />
                    )}
                </Box>

                {activePledge && (
                    <Box sx={{ position: 'absolute', top: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 5 }}>
                        <Zoom in={true}>
                            <Chip
                                icon={<Sparkles size={14} color={theme.palette.background.paper} />}
                                label={`Contributing to: ${activePledge.title}`}
                                sx={{
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    boxShadow: 3,
                                    fontWeight: 700,
                                    fontFamily: theme.typography.h6.fontFamily
                                }}
                            />
                        </Zoom>
                        <Box sx={{
                            display: 'flex',
                            gap: 2,
                            bgcolor: 'rgba(255,255,255,0.9)',
                            px: 2,
                            py: 0.5,
                            borderRadius: 4,
                            boxShadow: 1
                        }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: 'primary.dark' }}>
                                <Target size={14} /> My Total: {myContribution}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                <Users size={14} /> {activePledge.participants} Joined
                            </Typography>
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

                <Box sx={{ mt: 1, textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 3, fontWeight: 700 }}>
                        Mala Completed
                    </Typography>
                    <Typography variant="h3" color="primary.main">
                        {data.history[new Date().toISOString().split('T')[0]]?.malas || 0}
                    </Typography>
                </Box>

                {/* Feedback Toast */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            style={{
                                position: 'absolute',
                                bottom: 80,
                                backgroundColor: theme.palette.primary.main,
                                color: theme.palette.primary.contrastText,
                                padding: '12px 32px',
                                borderRadius: 16,
                                boxShadow: '0 8px 32px rgba(234, 88, 12, 0.3)'
                            }}
                        >
                            <Typography variant="h6">{feedback}</Typography>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            <Box sx={{ p: 2, textAlign: 'center', pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, alignItems: 'center' }}>
                    {!data.session.active ? (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<Play size={18} />}
                            onClick={(e) => { e.stopPropagation(); handleStartSession(); }}
                            sx={{ borderRadius: 8, px: 4 }}
                        >
                            Start Session
                        </Button>
                    ) : (
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                            {data.session.paused ? (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<Play size={18} />}
                                    onClick={(e) => { e.stopPropagation(); handleResumeSession(); }}
                                >
                                    Resume
                                </Button>
                            ) : (
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<Pause size={18} />}
                                    onClick={(e) => { e.stopPropagation(); handlePauseSession(); }}
                                >
                                    Pause
                                </Button>
                            )}
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<RotateCw size={18} />}
                                onClick={(e) => { e.stopPropagation(); handleResetSession(); }}
                            >
                                Reset Session
                            </Button>
                        </Box>
                    )}

                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={(e) => { e.stopPropagation(); handleTap(); }}
                        disabled={!data.session.active || data.session.paused}
                        sx={{ borderRadius: 8, px: 4 }}
                    >
                        Add Chant
                    </Button>

                    <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7, fontStyle: 'italic' }}>
                        {data.session.active ? `Session total: ${data.session.counts} chants · ${data.session.malas} malas` : 'Start a session to begin'}
                    </Typography>
                </Box>
            </Box>

            {/* iOS Haptic Workaround Elements */}
            <div
                style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}
                onClick={(e) => e.stopPropagation()}
            >
                <input type="checkbox" id="ios-haptic-switch" style={{ display: 'none' }} />
                {/* @ts-ignore - 'switch' attribute is non-standard but required for the hack */}
                <input type="checkbox" switch="true" id="ios-haptic-switch-trigger" style={{ display: 'none' }} />
                <label htmlFor="ios-haptic-switch-trigger" id="ios-haptic-label">Haptic</label>
            </div>
        </Box>
    );
};
