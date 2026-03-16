import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pledge } from '../types/pledge';
import { Users, Target, Edit2, Trash2 } from 'lucide-react';
import { Card, CardContent, Typography, Button, Box, LinearProgress, Chip, IconButton, Tooltip } from '@mui/material';

interface PledgeCardProps {
    pledge: Pledge;
    isJoined: boolean;
    onJoin: (pledge: Pledge) => void;
    onLeave?: (pledge: Pledge) => void;
    myContribution?: number;
    canManage?: boolean;
    onEdit?: (pledge: Pledge) => void;
    onDelete?: (pledge: Pledge) => void;
}

export const PledgeCard: React.FC<PledgeCardProps> = ({
    pledge,
    isJoined,
    onJoin,
    onLeave,
    myContribution,
    canManage,
    onEdit,
    onDelete
}) => {
    const { t } = useTranslation();
    // Global Progress
    const progress = Math.min(100, Math.round((pledge.currentMalas / pledge.targetMalas) * 100));

    return (
        <Card
            elevation={isJoined ? 4 : 1}
            onClick={() => onJoin(pledge)}
            sx={{
                position: 'relative',
                border: isJoined ? '2px solid' : '1px solid rgba(0,0,0,0.08)',
                borderColor: isJoined ? 'primary.main' : 'transparent',
                transition: 'all 0.2s',
                cursor: 'pointer',
                overflow: 'visible',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                    borderColor: 'primary.light'
                }
            }}
        >
            {isJoined && (
                <Chip
                    label={t('pledge.joined')}
                    color="primary"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 'bold', zIndex: 1 }}
                />
            )}

            {/* Management Controls */}
            {canManage && (
                <Box sx={{ position: 'absolute', top: 12, right: isJoined ? 80 : 12, zIndex: 2, display: 'flex', gap: 1 }}>
                    <Tooltip title={t('pledge.editCause')}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit?.(pledge);
                            }}
                            sx={{ bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white' } }}
                        >
                            <Edit2 size={16} color="#666" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('pledge.deleteCause')}>
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.(pledge);
                            }}
                            sx={{ bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white', color: 'red' } }}
                        >
                            <Trash2 size={16} color="#666" />
                        </IconButton>
                    </Tooltip>
                </Box>
            )}

            <CardContent>
                <Typography variant="h6" component="h3" gutterBottom sx={{ color: 'primary.dark', pr: 8 }}>
                    {pledge.title}
                </Typography>

                <Typography variant="body2" color="text.secondary" paragraph>
                    {pledge.description}
                </Typography>

                {pledge.mantra && (
                    <Box sx={{
                        textAlign: 'center',
                        py: 1.5,
                        my: 2,
                        bgcolor: 'background.default',
                        borderRadius: 2,
                        border: '1px dashed',
                        borderColor: 'divider'
                    }}>
                        <Typography variant="subtitle1" sx={{ color: 'secondary.main', fontWeight: 600, fontStyle: 'italic' }}>
                            "{pledge.mantra}"
                        </Typography>
                    </Box>
                )}

                {/* Personal Stats Section */}
                {isJoined && myContribution !== undefined && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: '#FFF7ED', borderRadius: 2, border: '1px solid', borderColor: '#FFEDD5' }}>
                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold">
                            {t('pledge.myContribution')}
                        </Typography>
                        <Typography variant="h4" color="primary.main" fontWeight="bold">
                            {myContribution} <Typography component="span" variant="body2" color="text.secondary">{t('pledge.malas')}</Typography>
                        </Typography>
                    </Box>
                )}

                {/* Global Stats Section */}
                <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Target size={14} /> {t('pledge.global')} {pledge.currentMalas} / {pledge.targetMalas}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Users size={14} /> {pledge.participants} {t('pledge.joinedCount')}
                        </Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={isNaN(progress) ? 0 : progress}
                        color="secondary"
                        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
                    />
                </Box>

                {!canManage && (
                    <Button
                        fullWidth
                        variant={isJoined ? "outlined" : "contained"}
                        color="primary"
                        onClick={(e) => {
                            e.stopPropagation(); // Check if parent click handles it
                            onJoin(pledge);
                        }}
                        sx={{ mt: 2 }}
                    >
                        {isJoined ? t('pledge.continueChanting') : t('pledge.joinCause')}
                    </Button>
                )}

                {canManage && (
                    <Button
                        fullWidth
                        variant={isJoined ? "outlined" : "contained"}
                        color="primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onJoin(pledge);
                        }}
                        sx={{ mt: 2 }}
                    >
                        {isJoined ? t('pledge.continueChanting') : t('pledge.joinYourCause')}
                    </Button>
                )}


                {isJoined && onLeave && !canManage && ( // Don't let creator 'leave' easily? Or maybe they can? User didn't specify. Standard is they can leave but delete is different. Let's hide Leave for creator if they have Delete, or keep it. I'll hide leave for creator to avoid confusion, they should Delete if they want out? Or maybe they just want to stop participating. Let's keep Leave hidden if canManage is true, to simplify.
                    <Button
                        fullWidth
                        size="small"
                        color="error"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(t('pledge.leaveConfirm'))) {
                                onLeave(pledge);
                            }
                        }}
                        sx={{ mt: 1, opacity: 0.7, '&:hover': { opacity: 1, bgcolor: 'error.50' } }}
                    >
                        {t('pledge.leaveCause')}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
