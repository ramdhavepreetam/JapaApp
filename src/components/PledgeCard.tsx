import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pledge } from '../types/pledge';
import { Target, Edit2, Trash2, CheckCircle2, QrCode } from 'lucide-react';
import { Card, CardContent, Typography, Button, Box, LinearProgress, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';

interface PledgeCardProps {
    pledge: Pledge;
    isJoined: boolean;
    onJoin: (pledge: Pledge) => void;
    onLeave?: (pledge: Pledge) => void;
    onContribute?: (pledge: Pledge) => void;
    myContribution?: number;
    canManage?: boolean;
    onEdit?: (pledge: Pledge) => void;
    onDelete?: (pledge: Pledge) => void;
    variant?: 'personal' | 'community';
}

export const PledgeCard: React.FC<PledgeCardProps> = ({
    pledge,
    isJoined,
    onJoin,
    onLeave,
    onContribute,
    myContribution,
    canManage,
    onEdit,
    onDelete,
    variant = 'community'
}) => {
    const { t } = useTranslation();
    const isPersonal = variant === 'personal';
    const [showQR, setShowQR] = useState(false);

    const guestUrl = `${window.location.origin}${window.location.pathname}?pledge=${pledge.id}`;
    const progress = Math.min(100, Math.round((pledge.currentMalas / pledge.targetMalas) * 100));
    const isCompleted = pledge.currentMalas >= pledge.targetMalas;

    return (
        <Card
            elevation={isJoined ? 4 : 1}
            onClick={() => !isPersonal && onJoin(pledge)}
            sx={{
                position: 'relative',
                border: isCompleted ? '2px solid' : isJoined ? '2px solid' : '1px solid rgba(0,0,0,0.08)',
                borderColor: isCompleted ? '#16A34A' : isJoined ? 'primary.main' : 'transparent',
                transition: 'all 0.2s',
                cursor: isPersonal ? 'default' : 'pointer',
                overflow: 'visible',
                bgcolor: isCompleted ? 'rgba(240,253,244,0.6)' : 'background.paper',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                    borderColor: isCompleted ? '#16A34A' : 'primary.light'
                }
            }}
        >
            {isCompleted && (
                <Chip
                    icon={<CheckCircle2 size={14} />}
                    label="Completed"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 'bold', zIndex: 1, bgcolor: '#16A34A', color: 'white' }}
                />
            )}
            {!isCompleted && isJoined && !isPersonal && (
                <Chip
                    label={t('pledge.joined')}
                    color="primary"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 'bold', zIndex: 1 }}
                />
            )}
            {!isPersonal && pledge.isPublic && !isJoined && !isCompleted && (
                <Chip
                    label={t('pledge.publicBadge')}
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 'bold', zIndex: 1, bgcolor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}
                />
            )}

            {/* Management Controls */}
            {(canManage || isPersonal) && (
                <Box sx={{ position: 'absolute', top: 12, right: isJoined && !isPersonal ? 80 : 12, zIndex: 2, display: 'flex', gap: 1 }}>
                    {!isPersonal && pledge.isPublic && (
                        <Tooltip title={t('pledge.shareQR')}>
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowQR(true);
                                }}
                                sx={{ bgcolor: 'rgba(255,255,255,0.8)', '&:hover': { bgcolor: 'white' } }}
                            >
                                <QrCode size={16} color="#92400E" />
                            </IconButton>
                        </Tooltip>
                    )}
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

                {pledge.description && (
                    <Typography variant="body2" color="text.secondary" paragraph>
                        {pledge.description}
                    </Typography>
                )}

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

                {/* Personal contribution */}
                {(isPersonal || (isJoined && myContribution !== undefined)) && (
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: '#FFF7ED', borderRadius: 2, border: '1px solid', borderColor: '#FFEDD5' }}>
                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold">
                            {t('pledge.myContribution')}
                        </Typography>
                        <Typography variant="h4" color="primary.main" fontWeight="bold">
                            {isPersonal ? pledge.currentMalas : myContribution}{' '}
                            <Typography component="span" variant="body2" color="text.secondary">{t('pledge.malas')}</Typography>
                        </Typography>
                    </Box>
                )}

                {/* Progress */}
                <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Target size={14} /> {pledge.currentMalas} / {pledge.targetMalas}
                        </Typography>
                        {!isPersonal && (
                            <Typography variant="caption" color="text.secondary">
                                {pledge.participants} {t('pledge.joinedCount')}
                            </Typography>
                        )}
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={isNaN(progress) ? 0 : progress}
                        color="secondary"
                        sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover' }}
                    />
                </Box>

                {/* Personal: Contribute button */}
                {isPersonal && !isCompleted && (
                    <Button
                        fullWidth
                        variant="contained"
                        color="primary"
                        onClick={(e) => {
                            e.stopPropagation();
                            onContribute?.(pledge);
                        }}
                        sx={{ mt: 2 }}
                    >
                        {t('pledge.contribute')}
                    </Button>
                )}
                {isPersonal && isCompleted && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 1 }}>
                        <CheckCircle2 size={18} color="#16A34A" />
                        <Typography variant="body2" sx={{ color: '#16A34A', fontWeight: 600 }}>
                            Pledge fulfilled!
                        </Typography>
                    </Box>
                )}

                {/* Community: Join / Continue Chanting */}
                {!isPersonal && !canManage && (
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
                        {isJoined ? t('pledge.continueChanting') : t('pledge.joinCause')}
                    </Button>
                )}

                {!isPersonal && canManage && (
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

                {/* Community: Leave */}
                {!isPersonal && isJoined && onLeave && !canManage && (
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

            {/* QR Code Dialog */}
            <Dialog
                open={showQR}
                onClose={() => setShowQR(false)}
                maxWidth="xs"
                fullWidth
                onClick={e => e.stopPropagation()}
            >
                <DialogTitle sx={{ textAlign: 'center', fontFamily: '"Playfair Display", serif', pb: 0 }}>
                    {pledge.title}
                </DialogTitle>
                <DialogContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3 }}>
                    <QRCodeSVG
                        value={guestUrl}
                        size={220}
                        includeMargin
                        level="M"
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', wordBreak: 'break-all', px: 1 }}>
                        {guestUrl}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                        Scan to offer malas to this cause
                    </Typography>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
