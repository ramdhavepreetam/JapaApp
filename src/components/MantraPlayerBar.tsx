import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Play, Pause, Repeat, Music2 } from 'lucide-react';
import { Box, Snackbar, Alert, Skeleton } from '@mui/material';
import { Mantra } from '../types/mantra';

const SAFFRON = '#EA580C';
const MAROON = '#881337';
const MAROON_DEEP = '#4C0519';
const CREAM = '#FFF8F0';
const CREAM_DIM = 'rgba(255,248,240,0.7)';
const GOLD = '#F59E0B';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5] as const;
type Speed = typeof SPEEDS[number];

interface MantraPlayerBarProps {
    mantras: Mantra[];
    loading: boolean;
}

export const MantraPlayerBar: React.FC<MantraPlayerBarProps> = ({ mantras, loading }) => {
    // null until the effect mounts — avoids StrictMode double-fire on src=''
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [selectedMantra, setSelectedMantra] = useState<Mantra | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState<Speed>(1);
    const [isLooping, setIsLooping] = useState(true);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [audioError, setAudioError] = useState(false);
    const [audioErrorMsg, setAudioErrorMsg] = useState('');
    const [progress, setProgress] = useState(0);

    // Set default mantra once library loads
    useEffect(() => {
        if (mantras.length > 0 && !selectedMantra) {
            setSelectedMantra(mantras[0]);
        }
    }, [mantras, selectedMantra]);

    // Use a ref for isLooping so the ended handler always sees the latest value
    // without needing to re-register listeners on every toggle
    const isLoopingRef = useRef(isLooping);
    useEffect(() => { isLoopingRef.current = isLooping; }, [isLooping]);

    // Create Audio element inside the effect — avoids StrictMode double-mount
    // firing error when cleanup sets src='' on the shared ref
    useEffect(() => {
        const audio = new Audio();
        audioRef.current = audio;

        const onEnded = () => { if (!isLoopingRef.current) setIsPlaying(false); };
        const onError = () => {
            const err = audio.error;
            const codes: Record<number, string> = {
                1: 'Playback aborted.',
                2: 'Network error loading audio.',
                3: 'Audio file could not be decoded.',
                4: 'Audio format not supported or file not found.',
            };
            setAudioErrorMsg(err ? (codes[err.code] || `Error ${err.code}`) : 'Unknown audio error.');
            setIsPlaying(false);
            setAudioError(true);
        };
        const onTimeUpdate = () => {
            if (audio.duration) setProgress(audio.currentTime / audio.duration);
        };

        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);
        audio.addEventListener('timeupdate', onTimeUpdate);

        return () => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.pause();
            audio.src = '';
            audioRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync loop + speed whenever they change
    useEffect(() => {
        if (audioRef.current) audioRef.current.loop = isLooping;
    }, [isLooping]);

    useEffect(() => {
        if (audioRef.current) audioRef.current.playbackRate = speed;
    }, [speed]);

    const selectMantra = useCallback((mantra: Mantra) => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        setIsPlaying(false);
        setProgress(0);
        setSelectedMantra(mantra);
        if (mantra.audioUrl) {
            audio.src = mantra.audioUrl;
            audio.loop = isLooping;
            audio.playbackRate = speed;
        } else {
            audio.src = '';
        }
        setPickerOpen(false);
    }, [isLooping, speed]);

    const togglePlay = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !selectedMantra?.audioUrl) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            if (!audio.src) {
                audio.src = selectedMantra.audioUrl;
                audio.loop = isLooping;
                audio.playbackRate = speed;
            }
            audio.play().catch(() => setIsPlaying(false));
            setIsPlaying(true);
        }
    }, [isPlaying, selectedMantra, isLooping, speed]);

    const handleSpeedChange = (e: React.MouseEvent, s: Speed) => {
        e.stopPropagation();
        setSpeed(s);
    };

    const handleLoopToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsLooping(prev => !prev);
    };

    const handleCollapseToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsCollapsed(prev => !prev);
        if (!isCollapsed) setPickerOpen(false);
    };

    const handlePickerToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isCollapsed) setPickerOpen(prev => !prev);
    };

    const traditionColor = (t: string) => {
        const map: Record<string, string> = {
            Shaiva: SAFFRON, Vaishnava: '#047857', Vedic: GOLD, Buddhist: '#7C3AED', Jain: '#0E7490'
        };
        return map[t] || SAFFRON;
    };

    if (loading) {
        return (
            <Box sx={{ background: MAROON, px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Skeleton variant="circular" width={32} height={32} sx={{ bgcolor: 'rgba(255,248,240,0.15)', flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="40%" height={10} sx={{ bgcolor: 'rgba(255,248,240,0.15)' }} />
                    <Skeleton variant="text" width="65%" height={14} sx={{ bgcolor: 'rgba(255,248,240,0.2)' }} />
                </Box>
            </Box>
        );
    }

    if (mantras.length === 0) return null;

    return (
        <>
            <Box
                sx={{
                    background: `linear-gradient(135deg, ${MAROON_DEEP} 0%, ${MAROON} 60%, #9F1239 100%)`,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(76,5,25,0.35)',
                    // Subtle devotional pattern overlay
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `radial-gradient(circle at 20% 50%, rgba(234,88,12,0.08) 0%, transparent 60%),
                                          radial-gradient(circle at 80% 50%, rgba(245,158,11,0.06) 0%, transparent 50%)`,
                        pointerEvents: 'none',
                    }
                }}
            >
                {/* Collapsed state — single icon row */}
                <AnimatePresence initial={false} mode="wait">
                    {isCollapsed ? (
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                        >
                            <Box
                                sx={{ display: 'flex', alignItems: 'center', px: 2, py: 0.75, gap: 1.5, cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); setIsCollapsed(false); }}
                            >
                                <Music2 size={14} color={SAFFRON} />
                                {isPlaying && (
                                    <Box sx={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        {[0, 1, 2].map(i => (
                                            <Box key={i} sx={{
                                                width: 3, height: 10, background: SAFFRON, borderRadius: 2,
                                                animation: `barsWave 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                                                '@keyframes barsWave': {
                                                    from: { transform: 'scaleY(0.3)' },
                                                    to: { transform: 'scaleY(1)' }
                                                }
                                            }} />
                                        ))}
                                    </Box>
                                )}
                                <Box sx={{ flex: 1, fontFamily: '"Playfair Display", serif', fontSize: 12, color: CREAM_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedMantra?.name}
                                </Box>
                                <ChevronDown size={14} color={CREAM_DIM} />
                            </Box>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                        >
                            {/* Main player row */}
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pt: 1, pb: 0.5, gap: 1 }}>
                                {/* Play / Pause button */}
                                <Box
                                    component="button"
                                    onClick={togglePlay}
                                    disabled={!selectedMantra?.audioUrl}
                                    sx={{
                                        width: 36, height: 36, borderRadius: '50%',
                                        background: selectedMantra?.audioUrl
                                            ? `radial-gradient(circle, ${SAFFRON} 0%, #C2410C 100%)`
                                            : 'rgba(255,248,240,0.2)',
                                        border: 'none', cursor: selectedMantra?.audioUrl ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                        boxShadow: selectedMantra?.audioUrl ? '0 2px 8px rgba(234,88,12,0.5)' : 'none',
                                        transition: 'transform 0.1s, box-shadow 0.2s',
                                        '&:active': { transform: 'scale(0.92)' },
                                        '&:disabled': { opacity: 0.4 },
                                    }}
                                >
                                    {isPlaying
                                        ? <Pause size={16} color={CREAM} fill={CREAM} />
                                        : <Play size={16} color={CREAM} fill={CREAM} style={{ marginLeft: 2 }} />
                                    }
                                </Box>

                                {/* Mantra name — tappable for picker */}
                                <Box
                                    onClick={handlePickerToggle}
                                    sx={{
                                        flex: 1, minWidth: 0, cursor: 'pointer',
                                        borderRadius: 1,
                                        px: 1, py: 0.25,
                                        border: `1px dashed ${pickerOpen ? SAFFRON : 'rgba(255,248,240,0.25)'}`,
                                        transition: 'border-color 0.2s, background 0.2s',
                                        '&:hover': { background: 'rgba(255,248,240,0.06)' },
                                    }}
                                >
                                    <Box sx={{ fontSize: 9, color: CREAM_DIM, letterSpacing: '0.08em', fontFamily: 'Inter, sans-serif' }}>
                                        {pickerOpen ? 'TAP TO CLOSE ↑' : 'TAP TO CHANGE ↓'}
                                    </Box>
                                    <Box sx={{
                                        fontSize: 13, fontFamily: '"Playfair Display", serif',
                                        fontWeight: 600, color: CREAM,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {selectedMantra?.name ?? 'Select Mantra'}
                                    </Box>
                                </Box>

                                {/* Loop toggle */}
                                <Box
                                    component="button"
                                    onClick={handleLoopToggle}
                                    sx={{
                                        background: 'none', border: 'none', cursor: 'pointer', p: 0.5,
                                        color: isLooping ? GOLD : CREAM_DIM,
                                        transition: 'color 0.2s',
                                        flexShrink: 0,
                                    }}
                                    title={isLooping ? 'Loop on' : 'Loop off'}
                                >
                                    <Repeat size={16} style={{ opacity: isLooping ? 1 : 0.35 }} />
                                </Box>

                                {/* Collapse */}
                                <Box
                                    component="button"
                                    onClick={handleCollapseToggle}
                                    sx={{ background: 'none', border: 'none', cursor: 'pointer', p: 0.5, color: CREAM_DIM, flexShrink: 0 }}
                                >
                                    <ChevronUp size={16} />
                                </Box>
                            </Box>

                            {/* Speed pills row */}
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, pb: 0.75, gap: 0.5 }}>
                                <Box sx={{ fontSize: 9, color: CREAM_DIM, letterSpacing: '0.08em', mr: 0.5, fontFamily: 'Inter, sans-serif' }}>SPEED</Box>
                                {SPEEDS.map(s => (
                                    <Box
                                        key={s}
                                        component="button"
                                        onClick={(e) => handleSpeedChange(e, s)}
                                        sx={{
                                            border: 'none', cursor: 'pointer', borderRadius: '4px',
                                            px: 0.75, py: 0.25, fontSize: 10,
                                            fontFamily: 'Inter, sans-serif', fontWeight: speed === s ? 700 : 400,
                                            background: speed === s ? CREAM : 'rgba(255,248,240,0.12)',
                                            color: speed === s ? MAROON : CREAM_DIM,
                                            transition: 'background 0.15s, color 0.15s, transform 0.1s',
                                            '&:active': { transform: 'scale(0.9)' },
                                        }}
                                    >
                                        {s}×
                                    </Box>
                                ))}

                                {/* Progress bar - right side */}
                                <Box sx={{ flex: 1, height: 2, background: 'rgba(255,248,240,0.15)', borderRadius: 1, ml: 1, overflow: 'hidden' }}>
                                    <Box sx={{
                                        height: '100%', background: SAFFRON, borderRadius: 1,
                                        width: `${progress * 100}%`, transition: 'width 0.5s linear',
                                    }} />
                                </Box>
                            </Box>

                            {/* Inline mantra picker */}
                            <AnimatePresence>
                                {pickerOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                                        style={{ overflow: 'hidden' }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <Box sx={{
                                            background: 'rgba(255,255,255,0.97)',
                                            borderTop: `2px solid ${SAFFRON}`,
                                            maxHeight: 240, overflowY: 'auto',
                                        }}>
                                            {mantras.map((m, i) => {
                                                const isSelected = selectedMantra?.id === m.id;
                                                return (
                                                    <motion.div
                                                        key={m.id}
                                                        initial={{ opacity: 0, x: -8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.04 }}
                                                    >
                                                        <Box
                                                            onClick={(e) => { e.stopPropagation(); selectMantra(m); }}
                                                            sx={{
                                                                display: 'flex', alignItems: 'center', gap: 1.5,
                                                                px: 2, py: 1,
                                                                cursor: 'pointer',
                                                                borderLeft: `3px solid ${isSelected ? SAFFRON : 'transparent'}`,
                                                                background: isSelected ? '#FFF3E0' : 'transparent',
                                                                transition: 'background 0.15s, border-color 0.15s',
                                                                '&:hover': { background: '#FFF8F0' },
                                                                '&:not(:last-child)': { borderBottom: '1px solid rgba(234,88,12,0.08)' }
                                                            }}
                                                        >
                                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                <Box sx={{
                                                                    fontSize: 13, fontFamily: '"Playfair Display", serif',
                                                                    fontWeight: isSelected ? 700 : 400,
                                                                    color: isSelected ? MAROON : '#451A1A',
                                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                                }}>
                                                                    {m.name}
                                                                </Box>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25 }}>
                                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                        <Box sx={{
                                                                            fontSize: 11, fontFamily: '"Noto Sans Devanagari", sans-serif',
                                                                            color: '#78350F', opacity: 0.85,
                                                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                        }}>
                                                                            {m.nameDevanagari}
                                                                        </Box>
                                                                        {m.nameMarathi && (
                                                                            <Box sx={{
                                                                                fontSize: 11, fontFamily: '"Noto Sans Devanagari", sans-serif',
                                                                                color: '#0E7490', opacity: 0.9,
                                                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                                            }}>
                                                                                {m.nameMarathi}
                                                                            </Box>
                                                                        )}
                                                                    </Box>
                                                                    <Box sx={{
                                                                        fontSize: 9, px: 0.75, py: 0.2,
                                                                        borderRadius: '3px', flexShrink: 0,
                                                                        background: `${traditionColor(m.tradition)}18`,
                                                                        color: traditionColor(m.tradition),
                                                                        fontFamily: 'Inter, sans-serif',
                                                                        fontWeight: 600, letterSpacing: '0.05em'
                                                                    }}>
                                                                        {m.tradition.toUpperCase()}
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                            {!m.audioUrl && (
                                                                <Box sx={{ fontSize: 9, color: '#9CA3AF', fontFamily: 'Inter', flexShrink: 0 }}>no audio</Box>
                                                            )}
                                                            {isSelected && m.audioUrl && (
                                                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: SAFFRON, flexShrink: 0 }} />
                                                            )}
                                                        </Box>
                                                    </motion.div>
                                                );
                                            })}
                                        </Box>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Box>

            {/* Audio error snackbar */}
            <Snackbar
                open={audioError}
                autoHideDuration={4000}
                onClose={() => setAudioError(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="warning" onClose={() => setAudioError(false)} sx={{ width: '100%' }}>
                    {audioErrorMsg || 'Could not load audio. Check your connection or try another mantra.'}
                </Alert>
            </Snackbar>
        </>
    );
};
