import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { pledgeService } from '../services/pledgeService';
import { Pledge } from '../types/pledge';
import {
    Box, Typography, LinearProgress, Button, CircularProgress,
    Paper, IconButton
} from '@mui/material';
import { Minus, Plus, CheckCircle2 } from 'lucide-react';

interface GuestJapaViewProps {
    pledgeId: string;
}

export const GuestJapaView: React.FC<GuestJapaViewProps> = ({ pledgeId }) => {
    const { t } = useTranslation();

    const [pledge, setPledge] = useState<Pledge | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const GUEST_MAX_MALAS = 25;
    const [malas, setMalas] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                // Sign in anonymously first so Firestore reads are authenticated.
                // Without this, permission-denied errors cause runWithFallback to
                // fall back to localStorage (which doesn't have the pledge).
                await signInAnonymously(auth);
                const data = await pledgeService.getPledgeById(pledgeId);
                if (!data || !data.isPublic) {
                    setLoadError(t('guest.notFound'));
                } else {
                    setPledge(data);
                }
            } catch {
                setLoadError(t('guest.errorLoad'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [pledgeId, t]);

    const handleSubmit = async () => {
        if (!pledge || malas <= 0) return;
        setSubmitting(true);
        setSubmitError(null);
        try {
            await pledgeService.guestContribute(pledgeId, malas);
            // Optimistically update local display
            setPledge(prev => prev ? { ...prev, currentMalas: prev.currentMalas + malas } : prev);
            setSubmitted(true);
        } catch (err: any) {
            setSubmitError(err.message || 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOfferMore = () => {
        setSubmitted(false);
        setMalas(1);
    };

    if (loading) {
        return (
            <Box sx={styles.page}>
                <CircularProgress sx={{ color: '#EA580C' }} />
                <Typography variant="body2" sx={{ mt: 2, color: '#92400E' }}>{t('guest.loading')}</Typography>
            </Box>
        );
    }

    if (loadError || !pledge) {
        return (
            <Box sx={styles.page}>
                <Typography variant="h6" sx={{ color: '#92400E', textAlign: 'center' }}>
                    {loadError || t('guest.notFound')}
                </Typography>
            </Box>
        );
    }

    const progress = Math.min(100, Math.round((pledge.currentMalas / pledge.targetMalas) * 100));

    return (
        <Box sx={styles.page}>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Typography variant="h4" sx={{ fontFamily: '"Playfair Display", serif', color: '#92400E', fontWeight: 700 }}>
                    🕉️
                </Typography>
                <Typography variant="h6" sx={{ color: '#92400E', fontWeight: 600, mt: 1 }}>
                    {t('guest.title')}
                </Typography>
            </Box>

            {/* Pledge Card */}
            <Paper elevation={2} sx={styles.pledgeCard}>
                <Typography variant="h5" sx={{ fontFamily: '"Playfair Display", serif', color: '#7C2D12', fontWeight: 700, mb: 1 }}>
                    {pledge.title}
                </Typography>

                {pledge.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {pledge.description}
                    </Typography>
                )}

                {pledge.mantra && (
                    <Box sx={styles.mantraBox}>
                        <Typography variant="subtitle1" sx={{ color: '#B45309', fontStyle: 'italic', fontWeight: 600 }}>
                            "{pledge.mantra}"
                        </Typography>
                    </Box>
                )}

                {/* Progress */}
                <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t('guest.progress', { current: pledge.currentMalas, target: pledge.targetMalas })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {progress}%
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={isNaN(progress) ? 0 : progress}
                        sx={{
                            height: 8, borderRadius: 4,
                            bgcolor: '#FEF3C7',
                            '& .MuiLinearProgress-bar': { bgcolor: '#EA580C' }
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('guest.participants', { count: pledge.participants })}
                    </Typography>
                </Box>
            </Paper>

            {/* Submission or Thank You */}
            {submitted ? (
                <Paper elevation={0} sx={{ ...styles.pledgeCard, bgcolor: '#F0FDF4', border: '1px solid #86EFAC', textAlign: 'center' }}>
                    <CheckCircle2 size={40} color="#16A34A" style={{ margin: '0 auto 8px' }} />
                    <Typography variant="h6" sx={{ color: '#15803D', fontWeight: 700 }}>
                        {t('guest.thankYou')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {t('guest.thankYouMsg')}
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleOfferMore}
                        sx={{ mt: 2, bgcolor: '#EA580C', '&:hover': { bgcolor: '#C2410C' } }}
                    >
                        {t('guest.offerMore')}
                    </Button>
                </Paper>
            ) : (
                <Paper elevation={2} sx={styles.pledgeCard}>
                    {/* Mala counter */}
                    <Typography variant="subtitle2" sx={{ color: '#92400E', fontWeight: 600, mb: 2, textAlign: 'center' }}>
                        {t('guest.malasLabel')}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, mb: 2 }}>
                        <IconButton
                            onClick={() => setMalas(m => Math.max(1, m - 1))}
                            sx={styles.counterBtn}
                            disabled={malas <= 1}
                        >
                            <Minus size={20} />
                        </IconButton>
                        <Box sx={{ textAlign: 'center', minWidth: 60 }}>
                            <Typography variant="h3" sx={{ color: '#EA580C', fontWeight: 700, lineHeight: 1 }}>
                                {malas}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {t('pledge.malas')}
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={() => setMalas(m => Math.min(GUEST_MAX_MALAS, m + 1))}
                            sx={styles.counterBtn}
                            disabled={malas >= GUEST_MAX_MALAS}
                        >
                            <Plus size={20} />
                        </IconButton>
                    </Box>

                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: -1 }}>
                        max {GUEST_MAX_MALAS} malas per submission
                    </Typography>

                    {submitError && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', textAlign: 'center', mb: 1 }}>
                            {submitError}
                        </Typography>
                    )}

                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        onClick={handleSubmit}
                        disabled={submitting}
                        sx={{ bgcolor: '#EA580C', '&:hover': { bgcolor: '#C2410C' }, py: 1.5, borderRadius: 3 }}
                    >
                        {submitting ? t('guest.submitting') : t('guest.submit')}
                    </Button>
                </Paper>
            )}

            {/* Download prompt */}
            <Box sx={{ textAlign: 'center', mt: 3, px: 2 }}>
                <Typography variant="caption" color="text.secondary">
                    {t('guest.joinApp')}
                </Typography>
            </Box>
        </Box>
    );
};

const styles = {
    page: {
        minHeight: '100dvh',
        bgcolor: '#FFFBEB',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
    },
    pledgeCard: {
        width: '100%',
        maxWidth: 420,
        p: 3,
        borderRadius: 3,
        mb: 2,
        bgcolor: 'white',
    },
    mantraBox: {
        textAlign: 'center' as const,
        py: 1.5,
        my: 1,
        bgcolor: '#FFFBEB',
        borderRadius: 2,
        border: '1px dashed #FCD34D',
    },
    counterBtn: {
        bgcolor: '#FEF3C7',
        '&:hover': { bgcolor: '#FDE68A' },
        width: 48,
        height: 48,
    },
};
