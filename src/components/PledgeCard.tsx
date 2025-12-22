import React from 'react';
import { Pledge } from '../services/community';
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
    // Global Progress
    const progress = Math.min(100, Math.round((pledge.currentMalas / pledge.targetMalas) * 100));

    return (
        <Card
            elevation={isJoined ? 4 : 1}
            onClick={() => onJoin(pledge)}
            sx={{
                position: 'relative',
                border: isJoined ? '2px solid #EA580C' : '1px solid rgba(0,0,0,0.08)',
                transition: 'all 0.2s',
                cursor: 'pointer',
                overflow: 'visible', // Ensure content isn't clipped
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                    borderColor: '#F97316'
                }
            }}
        >
            {isJoined && (
                <Chip
                    label="Joined"
                    color="primary"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12, fontWeight: 'bold', zIndex: 1 }}
                />
            )}

            {/* Management Controls */}
            {canManage && (
                <Box sx={{ position: 'absolute', top: 12, right: isJoined ? 80 : 12, zIndex: 2, display: 'flex', gap: 1 }}>
                    <Tooltip title="Edit Cause">
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
                    <Tooltip title="Delete Cause">
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
                    <Box sx={{ mb: 2, p: 1.5, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.100' }}>
                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold">
                            My Contribution
                        </Typography>
                        <Typography variant="h4" color="primary.main" fontWeight="bold">
                            {myContribution} <Typography component="span" variant="body2" color="text.secondary">Malas</Typography>
                        </Typography>
                    </Box>
                )}

                {/* Global Stats Section */}
                <Box sx={{ mt: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Target size={14} /> Global: {pledge.currentMalas} / {pledge.targetMalas}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Users size={14} /> {pledge.participants} joined
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
                        {isJoined ? "Continue Chanting" : "Join This Cause"}
                    </Button>
                )}

                {/* Creator sees Edit/Delete but still might want to see 'Continue Chanting' if they participate? 
                    Yes, creator is also a participant usually. 
                    Let's Keep the main button but maybe adjust if they canManage.
                    Actually the user requested: "only user who created the Start Cause can delete modify and save it. Other user's ... can not modify that."
                    It doesn't say creator can't contribute. Creator usually auto-joins.
                    So we should keep the Join/Continue button even for creator.
                 */}
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
                        {isJoined ? "Continue Chanting" : "Join Your Cause"}
                    </Button>
                )}


                {isJoined && onLeave && !canManage && ( // Don't let creator 'leave' easily? Or maybe they can? User didn't specify. Standard is they can leave but delete is different. Let's hide Leave for creator if they have Delete, or keep it. I'll hide leave for creator to avoid confusion, they should Delete if they want out? Or maybe they just want to stop participating. Let's keep Leave hidden if canManage is true, to simplify.
                    <Button
                        fullWidth
                        size="small"
                        color="error"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to leave this cause? Your progress will be reset.")) {
                                onLeave(pledge);
                            }
                        }}
                        sx={{ mt: 1, opacity: 0.7, '&:hover': { opacity: 1, bgcolor: 'error.50' } }}
                    >
                        Leave Cause
                    </Button>
                )}
            </CardContent>
        </Card>
    );
};
