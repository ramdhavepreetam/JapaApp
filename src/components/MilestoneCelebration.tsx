import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Typography, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Rank } from '../lib/ranks';
import { triggerHaptic } from '../lib/haptics';

interface MilestoneCelebrationProps {
    rank: Rank | null;
    onDismiss: () => void;
}

const PARTICLES = Array.from({ length: 24 }, (_, i) => i);

function playCelebrationSound() {
    try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, dur: number, vol: number) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            const t = audioCtx.currentTime + start;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.0001, t);
            gain.gain.exponentialRampToValueAtTime(vol, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            osc.start(t);
            osc.stop(t + dur);
        };
        playTone(528, 0, 0.6, 0.12);
        playTone(660, 0.7, 0.6, 0.10);
        playTone(792, 1.4, 1.2, 0.09);
        playTone(528, 2.8, 0.8, 0.06);
    } catch {}
}

export const MilestoneCelebration: React.FC<MilestoneCelebrationProps> = ({ rank, onDismiss }) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!rank) return;
        playCelebrationSound();
        triggerHaptic([300, 100, 300, 100, 300, 200, 700]);
    }, [rank?.id]);

    const subtitleKey = rank ? `ranks.${rank.id}_subtitle` : '';

    return (
        <AnimatePresence>
            {rank && (
                <motion.div
                    key={rank.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    onClick={onDismiss}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 200,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: rank.celebrationBg,
                        cursor: 'pointer',
                        overflow: 'hidden',
                    }}
                >
                    {/* Particle ring */}
                    <svg
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                        viewBox="0 0 400 700"
                    >
                        {PARTICLES.map((i) => {
                            const angle = (i / PARTICLES.length) * Math.PI * 2;
                            const cx = 200 + 160 * Math.cos(angle);
                            const cy = 350 + 160 * Math.sin(angle);
                            return (
                                <motion.circle
                                    key={i}
                                    cx={cx}
                                    cy={cy}
                                    r={5}
                                    fill={i % 2 === 0 ? rank.beadFill : rank.auraGlow.replace('rgba', 'rgb').replace(/,[^)]+\)/, ')')}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: [0, 1, 0.6, 1, 0], scale: [0, 1.4, 1, 1.2, 0] }}
                                    transition={{ duration: 2.5, delay: i * 0.08, repeat: Infinity, repeatDelay: 1 }}
                                />
                            );
                        })}
                    </svg>

                    {/* Om symbol */}
                    <motion.div
                        initial={{ scale: 0.3, opacity: 0 }}
                        animate={{ scale: [0.3, 1.2, 1.0], opacity: 1 }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                        style={{ marginBottom: 16 }}
                    >
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                        >
                            <Typography
                                variant="h1"
                                sx={{
                                    fontSize: '6rem',
                                    lineHeight: 1,
                                    color: rank.beadFill,
                                    textShadow: `0 0 30px ${rank.auraGlow}, 0 0 60px ${rank.auraGlow}`,
                                    fontFamily: '"Noto Sans Devanagari", sans-serif',
                                    userSelect: 'none',
                                }}
                            >
                                ॐ
                            </Typography>
                        </motion.div>
                    </motion.div>

                    {/* Sanskrit title */}
                    <motion.div
                        initial={{ y: 40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.6 }}
                    >
                        <Typography
                            sx={{
                                fontSize: '2.5rem',
                                fontFamily: '"Noto Sans Devanagari", sans-serif',
                                fontWeight: 700,
                                color: rank.beadFill,
                                textShadow: `0 0 20px ${rank.auraGlow}`,
                                textAlign: 'center',
                                letterSpacing: 2,
                                userSelect: 'none',
                            }}
                        >
                            {rank.titleSanskrit}
                        </Typography>
                    </motion.div>

                    {/* English title */}
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 1.0, duration: 0.5 }}
                    >
                        <Typography
                            variant="h4"
                            sx={{
                                color: 'rgba(255,255,255,0.9)',
                                textAlign: 'center',
                                mt: 0.5,
                                userSelect: 'none',
                            }}
                        >
                            {rank.titleEn}
                        </Typography>
                    </motion.div>

                    {/* Subtitle */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.2, duration: 0.6 }}
                    >
                        <Box sx={{ maxWidth: 300, mt: 2, px: 3 }}>
                            <Typography
                                variant="body2"
                                sx={{ color: 'rgba(255,255,255,0.75)', textAlign: 'center', lineHeight: 1.6, userSelect: 'none' }}
                            >
                                {t(subtitleKey, rank.titleEn)}
                            </Typography>
                        </Box>
                    </motion.div>

                    {/* Tap to continue */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1.8, duration: 0.5 }}
                        style={{ position: 'absolute', bottom: 48 }}
                    >
                        <Typography
                            variant="caption"
                            sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', userSelect: 'none' }}
                        >
                            {t('ranks.tapToContine', 'Tap to continue')}
                        </Typography>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
