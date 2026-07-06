import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, RotateCcw, Sparkles, Target, Users, Play, RotateCw, WifiOff, Wifi, Flame } from 'lucide-react';
import { storage, StorageSchema, PendingSyncItem, getTodayDate } from '../lib/storage';
import { isIOSLike, triggerHaptic } from '../lib/haptics';
import { BeadRing } from './BeadRing';
import { Pledge, PersonalPledge } from '../types/pledge';
import { Box, IconButton, Button, Typography, Chip, useTheme, Zoom, LinearProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useCommunity } from '../contexts/CommunityContext';
import { userService } from '../services/userService';
import { syncService } from '../services/syncService';
import { MantraPlayerBar } from './MantraPlayerBar';
import { mantraService } from '../services/mantraService';
import { Mantra } from '../types/mantra';

interface JapaCounterProps {
    // Legacy support
    activePledge?: Pledge | null;

    // Personal pledge mode
    activePersonalPledge?: PersonalPledge | null;
    onPersonalPledgeComplete?: (pledge: PersonalPledge) => void;

    // New Props
    mode?: 'personal' | 'pledge' | 'community' | 'guest-pledge';
    contextId?: string; // pledgeId or communityId
    onSaved?: (malas: number, mantras: number) => void;
    mantra?: string;
}

const iosSwitchAttribute = { switch: '' } as unknown as React.InputHTMLAttributes<HTMLInputElement>;
const MALA_COMPLETION_HAPTIC_PATTERN = [700, 150, 700, 150, 900];

export const JapaCounter: React.FC<JapaCounterProps> = ({
    activePledge,
    activePersonalPledge,
    onPersonalPledgeComplete,
    mode: modeProp = activePledge ? 'pledge' : 'personal',
    contextId: contextIdProp = activePledge?.id,
    onSaved,
    mantra = activePledge?.mantra ?? activePersonalPledge?.mantra
}) => {
    const mode = activePersonalPledge ? 'personal-pledge' : modeProp;
    const contextId = activePersonalPledge ? activePersonalPledge.id : contextIdProp;
    const { t } = useTranslation();
    const { user } = useAuth();
    const { myPledges, refresh: refreshPledges } = useCommunity();
    const [data, setData] = useState<StorageSchema>(storage.get());
    const personalMalasAdded = useRef(0);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [focusMode, setFocusMode] = useState<boolean>(() =>
        localStorage.getItem('japa_focus_mode') === 'true'
    );
    // Focus mode is only effective when a session is active
    const effectiveFocusMode = focusMode && data.session.active;

    const toggleFocusMode = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next = !focusMode;
        setFocusMode(next);
        localStorage.setItem('japa_focus_mode', String(next));
    };
    const [streakDays, setStreakDays] = useState<number>(0);
    const [mantras, setMantras] = useState<Mantra[]>([]);
    const [mantrasLoading, setMantrasLoading] = useState(true);
    const [mantraFontSize, setMantraFontSize] = useState<number>(() => {
        const saved = localStorage.getItem('japa_mantra_font_size');
        return saved ? parseInt(saved, 10) : 24;
    });
    const theme = useTheme();
    const useIOSNativeHapticTapTarget = isIOSLike();

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

    useEffect(() => {
        personalMalasAdded.current = 0;
    }, [activePersonalPledge?.id]);

    useEffect(() => {
        mantraService.getMantras().then(list => {
            setMantras(list);
            setMantrasLoading(false);
        }).catch(() => setMantrasLoading(false));
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
            if (profile.stats?.streakDays) {
                setStreakDays(profile.stats.streakDays);
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

    const playMalaCompletionSound = () => {
        if (!soundEnabled) return;
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

            const playTone = (frequency: number, startOffset: number, duration: number, volume: number) => {
                const oscillator = audioCtx.createOscillator();
                const gainNode = audioCtx.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioCtx.destination);

                const startAt = audioCtx.currentTime + startOffset;
                const endAt = startAt + duration;

                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(frequency, startAt);
                gainNode.gain.setValueAtTime(0.0001, startAt);
                gainNode.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
                gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

                oscillator.start(startAt);
                oscillator.stop(endAt);
            };

            playTone(660, 0, 0.18, 0.08);
            playTone(880, 0.2, 0.22, 0.09);
            playTone(1320, 0.48, 0.65, 0.07);
        } catch (e) {
            console.error("Audio error", e);
        }
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
            timestamp: Timestamp.now(),
            displayName: user.displayName || 'Devotee',
            photoURL: user.photoURL || '',
        };

        try {
            await communityJapaService.submitJapaEntry(contextId, entry);
            if (onSaved) onSaved(malas, mantras);
        } catch (e) {
            console.error("Failed to submit community entry", e);
        }

        // Whether it went to Firestore or the local queue, immediately try
        // to flush the queue so the entry reaches Firebase without waiting
        // for the next online event.
        syncService.syncAll();
    };

    const handleTap = async ({ hapticHandled = false }: { hapticHandled?: boolean } = {}) => {
        // Guard: don't count if session not started
        if (!data.session.active) {
            setFeedback(t('counter.startPrompt'));
            setTimeout(() => setFeedback(null), 2000);
            return;
        }
        if (!hapticHandled) {
            triggerHaptic(15);
        }
        playClickSound();

        const result = storage.increment();
        setData({ ...result.newData });

        if (result.malaCompleted) {
            triggerHaptic(MALA_COMPLETION_HAPTIC_PATTERN);
            playMalaCompletionSound();

            const msg = mode === 'community' ? t('counter.malaOffered')
                : (mode === 'pledge' || mode === 'guest-pledge' || mode === 'personal-pledge') ? t('counter.contributionSent')
                    : t('counter.malaCompleted');

            setFeedback(msg);
            setTimeout(() => setFeedback(null), 3000);

            if (mode === 'guest-pledge' && contextId) {
                import('../services/pledgeService').then(({ pledgeService }) => {
                    pledgeService.guestContribute(contextId, 1)
                        .then(() => onSaved?.(1, 108))
                        .catch((err: unknown) => console.error('Guest pledge contribute failed', err));
                });
            } else if (user) {
                // 1. Community Mode
                if (mode === 'community' && contextId) {
                    await submitCommunityEntry(1, 108);
                }
                // 2. Community Pledge Mode
                else if (mode === 'pledge' && contextId) {
                    import('../services/pledgeService').then(({ pledgeService: communityService }) => {
                        communityService.contribute(contextId!, user.uid, 1)
                            .then(() => {
                                refreshPledges();
                            })
                            .catch((err: unknown) => console.error('Pledge contribute failed', err));
                    });
                    userService.updateUserStats(user.uid, 1, 108).catch(() => { queueSync(108, 1); syncPending(); });
                }
                // 3. Personal Pledge Mode
                else if (mode === 'personal-pledge' && contextId && activePersonalPledge) {
                    personalMalasAdded.current += 1;
                    import('../services/personalPledgeService').then(({ personalPledgeService }) => {
                        personalPledgeService.contributeToPersonalPledge(user.uid, contextId!, 1)
                            .catch((err: unknown) => console.error('Personal pledge contribute failed', err));
                    });
                    userService.updateUserStats(user.uid, 1, 108).catch(() => { queueSync(108, 1); syncPending(); });

                    const newTotal = activePersonalPledge.currentMalas + personalMalasAdded.current;
                    if (newTotal >= activePersonalPledge.targetMalas) {
                        onPersonalPledgeComplete?.(activePersonalPledge);
                    }
                }
                // 4. Personal Mode
                else {
                    userService.updateUserStats(user.uid, 1, 108).catch(() => { queueSync(108, 1); syncPending(); });
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

    const handleIOSNativeHapticTap = (e: React.MouseEvent<HTMLInputElement>) => {
        e.stopPropagation();
        handleTap({ hapticHandled: true });
    };

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
        setFocusMode(false);
        localStorage.setItem('japa_focus_mode', 'false');
        setFeedback("Session saved & reset");
        setTimeout(() => setFeedback(null), 2000);
        if (mode !== 'community') syncPending();
    };


    return (
        <Box
            sx={{
                minHeight: '100%',
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                cursor: 'pointer',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'manipulation',
                background: effectiveFocusMode
                    ? 'linear-gradient(160deg, #1a0800 0%, #3d1200 60%, #7c2d00 100%)'
                    : 'transparent',
                transition: 'background 0.3s ease',
            }}
            onClick={() => { handleTap(); }}
        >
            {/* Mantra Audio Player Bar */}
            {!effectiveFocusMode && (
                <Box sx={{ pointerEvents: 'auto', zIndex: 20 }} onClick={e => e.stopPropagation()}>
                    <MantraPlayerBar mantras={mantras} loading={mantrasLoading} />
                </Box>
            )}

            {/* Header / Top Bar */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pl: 2, pr: 2, py: 2, zIndex: 10, pointerEvents: 'none' }}>
                {/* Left icons — hidden in focus mode */}
                {!effectiveFocusMode && (
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
                )}
                {effectiveFocusMode && <Box />}

                {/* Focus toggle — only shown when session is active */}
                {data.session.active && (
                    <Box sx={{ pointerEvents: 'auto' }}>
                        <Button
                            onClick={toggleFocusMode}
                            variant={effectiveFocusMode ? 'contained' : 'outlined'}
                            color="secondary"
                            size="small"
                            sx={{
                                borderRadius: 20,
                                px: 1.5,
                                py: 0.5,
                                minWidth: 'auto',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                lineHeight: 1.2,
                                ...(effectiveFocusMode && { color: 'secondary.contrastText' }),
                            }}
                        >
                            {t('counter.focus')}
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Main Center Content */}
            <Box sx={{ flex: 1, minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', p: 2 }}>
                {useIOSNativeHapticTapTarget && (
                    <input
                        {...iosSwitchAttribute}
                        type="checkbox"
                        aria-label="Count mantra"
                        disabled={!data.session.active}
                        tabIndex={-1}
                        onClick={handleIOSNativeHapticTap}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            margin: 0,
                            border: 0,
                            opacity: 0.001,
                            zIndex: 2,
                            cursor: data.session.active ? 'pointer' : 'default',
                        }}
                    />
                )}

                {!effectiveFocusMode && (
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
                )}

                {/* Mode Specific Badges */}
                {!effectiveFocusMode && (mode === 'pledge' || mode === 'guest-pledge') && activePledge && (
                    <Box sx={{ position: 'absolute', top: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 5 }}>
                        <Zoom in={true}>
                            <Chip
                                icon={<Sparkles size={14} color={theme.palette.background.paper} />}
                                label={`${mode === 'guest-pledge' ? 'Offering to' : 'Contributing to'}: ${activePledge.title}`}
                                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', boxShadow: 3, fontWeight: 700 }}
                            />
                        </Zoom>
                        <Box sx={{ display: 'flex', gap: 2, bgcolor: 'rgba(255,255,255,0.9)', px: 2, py: 0.5, borderRadius: 4, boxShadow: 1 }}>
                            {mode === 'pledge' && (
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: 'primary.dark' }}>
                                    <Target size={14} /> My Total: {myContribution}
                                </Typography>
                            )}
                            {mode === 'guest-pledge' && (
                                <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: 'primary.dark' }}>
                                    <Target size={14} /> {activePledge.currentMalas} / {activePledge.targetMalas}
                                </Typography>
                            )}
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                <Users size={14} /> {activePledge.participants} Joined
                            </Typography>
                        </Box>
                    </Box>
                )}

                {!effectiveFocusMode && mode === 'personal-pledge' && activePersonalPledge && (
                    <Box sx={{ position: 'absolute', top: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, zIndex: 5 }}>
                        <Zoom in={true}>
                            <Chip
                                icon={<Sparkles size={14} color={theme.palette.background.paper} />}
                                label={`Personal: ${activePersonalPledge.title}`}
                                sx={{ bgcolor: 'secondary.main', color: 'secondary.contrastText', boxShadow: 3, fontWeight: 700 }}
                            />
                        </Zoom>
                        <Box sx={{ display: 'flex', gap: 2, bgcolor: 'rgba(255,255,255,0.9)', px: 2, py: 0.5, borderRadius: 4, boxShadow: 1 }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 600, color: 'primary.dark' }}>
                                <Target size={14} /> {activePersonalPledge.currentMalas} / {activePersonalPledge.targetMalas} malas
                            </Typography>
                        </Box>
                    </Box>
                )}

                {/* Community Mode overlay handled by parent usually, but good to have indicator if standalone */}

                {/* Mantra Display */}
                {mantra && (
                    <Box sx={{
                        position: 'relative',
                        mt: effectiveFocusMode ? 4 : 8,
                        mb: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        maxWidth: 360,
                        minHeight: 80, // Reserve space to prevent layout shift
                        pointerEvents: 'auto',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        MozUserSelect: 'none',
                        WebkitTouchCallout: 'none'
                    }}>
                        <Typography
                            variant="body1"
                            sx={{
                                fontSize: `${mantraFontSize}px`,
                                fontFamily: theme.typography.fontFamily,
                                fontStyle: 'italic',
                                fontWeight: 500,
                                color: effectiveFocusMode ? 'rgba(253,235,208,0.4)' : 'primary.main',
                                textAlign: 'center',
                                transition: 'font-size 0.2s ease-in-out, color 0.3s ease',
                                px: 2,
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                            }}
                        >
                            "{mantra}"
                        </Typography>

                        {/* Font Size Controls */}
                        {!effectiveFocusMode && (
                            <Box sx={{ position: 'relative', zIndex: 3, display: 'flex', gap: 1, mt: 1, opacity: 0.5, '&:hover': { opacity: 1 }, transition: 'opacity 0.2s' }}>
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
                        )}
                    </Box>
                )}

                {/* BeadRing — scaled up in focus mode */}
                <Box sx={{ transform: effectiveFocusMode ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.3s ease' }}>
                    <BeadRing count={data.currentCount} />
                </Box>

                {/* Progress bar */}
                <Box sx={{ mt: 1, width: '100%', maxWidth: 320, opacity: effectiveFocusMode ? 0.4 : 1, transition: 'opacity 0.3s ease' }}>
                    <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (data.currentCount / 108) * 100)}
                        sx={{
                            height: effectiveFocusMode ? 3 : 8,
                            borderRadius: 6,
                            bgcolor: 'action.hover',
                            transition: 'height 0.3s ease',
                        }}
                    />
                    {!effectiveFocusMode && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                            {data.currentCount} / 108 beads
                        </Typography>
                    )}
                </Box>

                {effectiveFocusMode ? (
                    <Box sx={{ mt: 2, textAlign: 'center' }}>
                        <Typography variant="h2" sx={{ color: 'rgba(234,88,12,0.9)', fontWeight: 800, lineHeight: 1, textShadow: '0 0 20px rgba(234,88,12,0.4)' }}>
                            {data.history[getTodayDate()]?.malas || 0}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(253,235,208,0.4)', letterSpacing: 3, textTransform: 'uppercase', display: 'block' }}>
                            {t('counter.malas')} {t('counter.today').toLowerCase()}
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ mt: 1, display: 'flex', gap: 3, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                                {t('counter.today')}
                            </Typography>
                            <Typography variant="h3" color="primary.main" sx={{ lineHeight: 1 }}>
                                {data.history[getTodayDate()]?.malas || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{t('counter.malas')}</Typography>
                        </Box>
                        <Box sx={{ width: '1px', height: 56, bgcolor: 'divider' }} />
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                                {t('counter.lifetime')}
                            </Typography>
                            <Typography variant="h3" color="secondary.main" sx={{ lineHeight: 1 }}>
                                {data.totalMalas}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{t('counter.malas')}</Typography>
                        </Box>
                        {streakDays > 0 && (
                            <>
                                <Box sx={{ width: '1px', height: 56, bgcolor: 'divider' }} />
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 2, fontWeight: 700, display: 'block' }}>
                                        {t('counter.streak', 'Streak')}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                        <Flame size={20} color="#ea580c" />
                                        <Typography variant="h3" sx={{ lineHeight: 1, color: '#ea580c' }}>
                                            {streakDays}
                                        </Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">{t('counter.days', 'days')}</Typography>
                                </Box>
                            </>
                        )}
                    </Box>
                )}

                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            style={{
                                position: 'absolute', bottom: 80,
                                backgroundColor: effectiveFocusMode
                                    ? 'rgba(253,235,208,0.12)'
                                    : theme.palette.primary.main,
                                color: effectiveFocusMode
                                    ? 'rgba(253,235,208,0.9)'
                                    : theme.palette.primary.contrastText,
                                padding: '12px 32px', borderRadius: 16,
                                boxShadow: effectiveFocusMode
                                    ? '0 8px 32px rgba(0,0,0,0.4)'
                                    : '0 8px 32px rgba(234, 88, 12, 0.3)',
                            }}
                        >
                            <Typography variant="h6">{feedback}</Typography>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {/* Controls */}
            {!effectiveFocusMode && (
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
                            <Button
                                variant="outlined" color="error" startIcon={<RotateCw size={18} />}
                                onClick={(e) => { e.stopPropagation(); handleResetSession(); }}
                            >
                                {t('counter.resetSession')}
                            </Button>
                        )}

                        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                            <Button
                                variant="contained" color="secondary"
                                onClick={(e) => { e.stopPropagation(); handleTap(); }}
                                disabled={!data.session.active}
                                sx={{
                                    borderRadius: 8,
                                    px: 4,
                                    ...(useIOSNativeHapticTapTarget && data.session.active ? { pointerEvents: 'none' } : {}),
                                }}
                            >
                                {t('counter.addChant')}
                            </Button>
                            {useIOSNativeHapticTapTarget && (
                                <input
                                    {...iosSwitchAttribute}
                                    type="checkbox"
                                    aria-label={t('counter.addChant')}
                                    disabled={!data.session.active}
                                    tabIndex={-1}
                                    onClick={handleIOSNativeHapticTap}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        width: '100%',
                                        height: '100%',
                                        margin: 0,
                                        border: 0,
                                        opacity: 0.001,
                                        cursor: data.session.active ? 'pointer' : 'default',
                                    }}
                                />
                            )}
                        </Box>

                        <Typography variant="body2" color="text.secondary" sx={{ opacity: 0.7, fontStyle: 'italic' }}>
                            {data.session.active ? t('counter.sessionTotal', { malas: data.session.malas }) : t('counter.startPrompt')}
                        </Typography>
                    </Box>
                </Box>
            )}
        </Box>
    );
};
