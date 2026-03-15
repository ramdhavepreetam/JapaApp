import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, List, ListItem, ListItemAvatar, ListItemText, LinearProgress } from '@mui/material';
import { JapaCounter } from '../JapaCounter';
import { Community, JapaEntry } from '../../types/community';
import { communityJapaService } from '../../services/communityJapaService';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Zap } from 'lucide-react';

interface CommunityCounterTabProps {
    community: Community;
    onViewReport: () => void;
    onCommunityUpdated?: () => void;
}

export const CommunityCounterTab: React.FC<CommunityCounterTabProps> = ({ community, onViewReport, onCommunityUpdated }) => {
    const { user } = useAuth();
    const [recentEntries, setRecentEntries] = useState<JapaEntry[]>([]);
    const [localTotalMalas, setLocalTotalMalas] = useState(community.totalMalas);
    const [myContribution, setMyContribution] = useState<number>(0);

    // Refresh only the feed (safe to poll quickly)
    const refreshFeed = () => {
        communityJapaService.getRecentEntries(community.id).then(setRecentEntries);
    };

    // Fetch my specific contribution efficiently via resilient service ONCE, to avoid stale transaction reads
    const fetchMyContribution = () => {
        if (user) {
            import('../../services/communityService').then(({ communityService }) => {
                communityService.getCommunityMember(community.id, user.uid).then(member => {
                    if (member) {
                        setMyContribution(member.totalMalas || 0);
                    }
                });
            });
        }
    };

    useEffect(() => {
        refreshFeed();
        fetchMyContribution();
        // Poll every 30s for feed updates
        const interval = setInterval(refreshFeed, 30000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [community.id, user]);

    // Sync localTotalMalas when parent re-renders with updated community data
    useEffect(() => {
        setLocalTotalMalas(community.totalMalas);
    }, [community.totalMalas]);

    const handleSaved = (malas: number, _mantras: number) => {
        // 1. Optimistic UI update — instant feedback
        setLocalTotalMalas(prev => prev + malas);
        setMyContribution(prev => prev + malas);

        // 2. Delayed re-fetch to confirm real values after transaction/mock settles
        setTimeout(() => {
            refreshFeed();
            fetchMyContribution();
            if (community.id) {
                import('../../services/communityService').then(({ communityService }) => {
                    communityService.getCommunity(community.id).then(c => {
                        if (c) setLocalTotalMalas(c.totalMalas);
                    });
                });
            }
            // Notify parent to refresh its community state too
            onCommunityUpdated?.();
        }, 500);
    };

    // Calculate progress (arbitrary goal for now? 1M? or infinite)
    const goal = 1000000;
    const progress = Math.min(100, (localTotalMalas / goal) * 100);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

            {/* Top Stats Bar */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 0.5 }}>
                        <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1 }}>Community Goal</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.dark', bgcolor: 'primary.light', px: 1, py: 0.25, borderRadius: 1 }}>
                            My Total: {myContribution.toLocaleString()}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 10, borderRadius: 5 }} />
                        <Typography variant="caption" fontWeight="bold">{progress.toFixed(1)}%</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <Zap size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {localTotalMalas.toLocaleString()} / {goal.toLocaleString()} Malas
                    </Typography>
                </Box>
            </Box>

            {/* Counter Section - Takes up most space */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <JapaCounter
                    mode="community"
                    contextId={community.id}
                    onViewReport={onViewReport}
                    onSaved={handleSaved}
                />
            </Box>

            {/* Bottom Activity Feed (Collapsible or small scrollabel area?) 
                Let's make it a small drawer or section at bottom.
            */}
            <Box sx={{ height: '25%', minHeight: 150, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ p: 1, px: 2, bgcolor: 'action.hover', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Clock size={14} /> Recent Activity
                </Typography>
                <List dense sx={{ flex: 1, overflowY: 'auto' }}>
                    {recentEntries.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
                            <Typography variant="caption">No recent chants. Be the first!</Typography>
                        </Box>
                    ) : (
                        recentEntries.map((entry) => (
                            <ListItem key={entry.id}>
                                <ListItemAvatar>
                                    <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                                        {entry.userId === user?.uid ? 'Me' : '?'}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={
                                        <Typography variant="body2">
                                            {entry.userId === user?.uid ? 'You' : 'A Member'} chanted <b>{entry.malas} malas</b>
                                        </Typography>
                                    }
                                    secondary={
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(
                                                (entry as any).queuedAt
                                                    ? (entry as any).queuedAt
                                                    : (entry.timestamp as any)?.seconds
                                                        ? (entry.timestamp as any).seconds * 1000
                                                        : Date.now()
                                            ).toLocaleTimeString()}
                                        </Typography>
                                    }
                                />
                            </ListItem>
                        ))
                    )}
                </List>
            </Box>
        </Box>
    );
};
