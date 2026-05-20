import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { Box, CircularProgress, LinearProgress, Paper, Typography } from '@mui/material';
import { JapaCounter } from './JapaCounter';
import { pledgeService } from '../services/pledgeService';
import { Pledge } from '../types/pledge';

interface GuestJapaViewProps {
    pledgeId: string;
}

export const GuestJapaView: React.FC<GuestJapaViewProps> = ({ pledgeId }) => {
    const { t } = useTranslation();
    const [pledge, setPledge] = useState<Pledge | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                // Keep anonymous auth as a best-effort compatibility path for
                // existing rules, but public QR pledges must also work without it.
                if (!auth.currentUser) {
                    await signInAnonymously(auth).catch(() => undefined);
                }

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

    if (loading) {
        return (
            <Box sx={styles.loadingPage}>
                <CircularProgress sx={{ color: '#EA580C' }} />
                <Typography variant="body2" sx={{ mt: 2, color: '#92400E' }}>{t('guest.loading')}</Typography>
            </Box>
        );
    }

    if (loadError || !pledge) {
        return (
            <Box sx={styles.loadingPage}>
                <Typography variant="h6" sx={{ color: '#92400E', textAlign: 'center' }}>
                    {loadError || t('guest.notFound')}
                </Typography>
            </Box>
        );
    }

    const progress = Math.min(100, Math.round((pledge.currentMalas / pledge.targetMalas) * 100));

    return (
        <Box sx={styles.page}>
            <Paper elevation={1} sx={styles.pledgeSummary}>
                <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif', color: '#7C2D12', fontWeight: 700 }}>
                    {pledge.title}
                </Typography>
                {pledge.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {pledge.description}
                    </Typography>
                )}
                <Box sx={{ mt: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                            {t('guest.progress', { current: pledge.currentMalas, target: pledge.targetMalas })}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {isNaN(progress) ? 0 : progress}%
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={isNaN(progress) ? 0 : progress}
                        sx={{
                            height: 8,
                            borderRadius: 4,
                            bgcolor: '#FEF3C7',
                            '& .MuiLinearProgress-bar': { bgcolor: '#EA580C' }
                        }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('guest.participants', { count: pledge.participants })}
                    </Typography>
                </Box>
            </Paper>

            <Box sx={styles.counterWrap}>
                <JapaCounter
                    activePledge={pledge}
                    mode="guest-pledge"
                    contextId={pledge.id}
                    mantra={pledge.mantra}
                    onSaved={(malas) => {
                        setPledge(prev => prev ? { ...prev, currentMalas: prev.currentMalas + malas } : prev);
                    }}
                />
            </Box>
        </Box>
    );
};

const styles = {
    loadingPage: {
        minHeight: '100dvh',
        bgcolor: '#FFFBEB',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
    },
    page: {
        height: '100dvh',
        width: '100%',
        bgcolor: '#FFFBEB',
        color: 'text.primary',
        display: 'flex',
        flexDirection: 'column' as const,
        overflow: 'hidden',
    },
    pledgeSummary: {
        m: 2,
        mb: 0,
        p: 2,
        borderRadius: 3,
        bgcolor: 'white',
        flexShrink: 0,
    },
    counterWrap: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
    },
};
