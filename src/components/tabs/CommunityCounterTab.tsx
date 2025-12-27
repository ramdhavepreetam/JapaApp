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
}

export const CommunityCounterTab: React.FC<CommunityCounterTabProps> = ({ community, onViewReport }) => {
    const { user } = useAuth();
    const [recentEntries, setRecentEntries] = useState<JapaEntry[]>([]);

    // Refresh entries on mount and after save
    const refreshEntries = () => {
        communityJapaService.getRecentEntries(community.id).then(setRecentEntries);
    };

    useEffect(() => {
        refreshEntries();
        // Poll every 30s for updates? Or just leave it as manual refresh on action
        const interval = setInterval(refreshEntries, 30000);
        return () => clearInterval(interval);
    }, [community.id]);

    const handleSaved = () => {
        refreshEntries();
    };

    // Calculate progress (arbitrary goal for now? 1M? or infinite)
    const goal = 1000000;
    const progress = Math.min(100, (community.totalMalas / goal) * 100);

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>

            {/* Top Stats Bar */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="overline" color="text.secondary" fontWeight="bold">Community Goal</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 10, borderRadius: 5 }} />
                        <Typography variant="caption" fontWeight="bold">{progress.toFixed(1)}%</Typography>
                    </Box>
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                        <Zap size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {community.totalMalas.toLocaleString()} / {goal.toLocaleString()} Malas
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
                                            {new Date((entry.timestamp as any).seconds * 1000).toLocaleTimeString()}
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
