import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, List, ListItem, ListItemAvatar, LinearProgress, IconButton } from '@mui/material';
import { JapaCounter } from '../JapaCounter';
import { Community, JapaEntry } from '../../types/community';
import { communityJapaService } from '../../services/communityJapaService';
import { japaReactionService, JapaReactions, ReactionType } from '../../services/japaReactionService';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, Zap } from 'lucide-react';

interface CommunityCounterTabProps {
    community: Community;
    onCommunityUpdated?: () => void;
}

export const CommunityCounterTab: React.FC<CommunityCounterTabProps> = ({ community, onCommunityUpdated }) => {
    const { user } = useAuth();
    const [recentEntries, setRecentEntries] = useState<JapaEntry[]>([]);
    const [localTotalMalas, setLocalTotalMalas] = useState(community.totalMalas);
    const [myContribution, setMyContribution] = useState<number>(0);
    const [reactions, setReactions] = useState<Record<string, JapaReactions>>({});
    const [reactionLoading, setReactionLoading] = useState<string | null>(null);

    // Refresh only the feed (safe to poll quickly)
    const refreshFeed = () => {
        communityJapaService.getRecentEntries(community.id).then(entries => {
            setRecentEntries(entries);
            const ids = entries.map(e => e.id);
            if (ids.length > 0) {
                japaReactionService.getBatchReactions(community.id, ids).then(setReactions);
            }
        });
    };

    const handleReaction = async (entryId: string, type: ReactionType) => {
        if (!user) return;
        const key = entryId + type;
        setReactionLoading(key);
        try {
            const updated = await japaReactionService.toggleReaction(community.id, entryId, user.uid, type);
            setReactions(prev => ({ ...prev, [entryId]: updated }));
        } finally {
            setReactionLoading(null);
        }
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
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>

            {/* Top Stats Bar — compact single row */}
            <Box sx={{ px: 2, py: 1, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="overline" color="text.secondary" fontWeight="bold" sx={{ lineHeight: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Zap size={12} /> Community Goal
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.dark', bgcolor: 'primary.light', px: 1, py: 0.25, borderRadius: 1 }}>
                        My Total: {myContribution.toLocaleString()} · {localTotalMalas.toLocaleString()} / {goal.toLocaleString()}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 6, borderRadius: 5 }} />
                    <Typography variant="caption" fontWeight="bold" sx={{ minWidth: 36 }}>{progress.toFixed(1)}%</Typography>
                </Box>
            </Box>

            {/* Counter Section — natural height, never clipped */}
            <Box sx={{ flex: '1 0 auto' }}>
                <JapaCounter
                    mode="community"
                    contextId={community.id}
                    onSaved={handleSaved}
                />
            </Box>

            {/* Recent Sessions — with reactions */}
            <Box sx={{ maxHeight: 300, bgcolor: 'background.paper', borderTop: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="subtitle2" sx={{ p: 1, px: 2, bgcolor: 'action.hover', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Clock size={14} /> Recent Sessions
                </Typography>
                <List dense sx={{ flex: 1, overflowY: 'auto' }}>
                    {recentEntries.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
                            <Typography variant="caption">No recent chants. Be the first!</Typography>
                        </Box>
                    ) : (
                        recentEntries.map((entry) => {
                            const isMe = entry.userId === user?.uid;
                            const name = isMe ? 'You' : (entry.displayName || 'Devotee');
                            const initial = name.charAt(0).toUpperCase();
                            const entryDate = (entry as any).queuedAt
                                ? new Date((entry as any).queuedAt)
                                : entry.timestamp?.toDate
                                    ? entry.timestamp.toDate()
                                    : new Date((entry.timestamp as any)?.seconds * 1000 || Date.now());
                            const timeAgo = (() => {
                                const diffMs = Date.now() - entryDate.getTime();
                                const mins = Math.floor(diffMs / 60000);
                                if (mins < 1) return 'just now';
                                if (mins < 60) return `${mins}m ago`;
                                const hrs = Math.floor(mins / 60);
                                if (hrs < 24) return `${hrs}h ago`;
                                return entryDate.toLocaleDateString();
                            })();
                            const entryReactions = reactions[entry.id];
                            const myReaction = entryReactions?.reactors[user?.uid || ''] as ReactionType | undefined;
                            const REACTION_EMOJIS: Record<ReactionType, string> = { pranams: '🙏', heart: '❤️', sparkle: '✨' };
                            return (
                                <ListItem key={entry.id} sx={{ py: 0.5, alignItems: 'flex-start' }}>
                                    <ListItemAvatar>
                                        <Avatar
                                            src={isMe ? (user?.photoURL || '') : (entry.photoURL || '')}
                                            sx={{ width: 28, height: 28, fontSize: 12, bgcolor: isMe ? 'primary.main' : 'secondary.main', mt: 0.5 }}
                                        >
                                            {initial}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="body2">
                                            <b>{name}</b> chanted {entry.malas > 0 ? <><b>{entry.malas}</b> mala{entry.malas !== 1 ? 's' : ''}</> : <><b>{entry.mantras}</b> mantras</>}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', mt: 0.25 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                                                {timeAgo}
                                            </Typography>
                                            {!isMe && (['pranams', 'heart', 'sparkle'] as ReactionType[]).map(rType => {
                                                const count = entryReactions?.[rType] || 0;
                                                const active = myReaction === rType;
                                                const busy = reactionLoading === entry.id + rType;
                                                return (
                                                    <IconButton
                                                        key={rType}
                                                        size="small"
                                                        onClick={() => handleReaction(entry.id, rType)}
                                                        disabled={busy}
                                                        sx={{
                                                            px: 0.75, py: 0.25, borderRadius: 2,
                                                            fontSize: '0.75rem', lineHeight: 1,
                                                            bgcolor: active ? 'primary.light' : 'action.hover',
                                                            color: active ? 'primary.dark' : 'text.secondary',
                                                            '&:hover': { bgcolor: 'primary.light' },
                                                            minWidth: 'auto', gap: 0.25
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '0.85rem' }}>{REACTION_EMOJIS[rType]}</span>
                                                        {count > 0 && (
                                                            <Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                                                                {count}
                                                            </Typography>
                                                        )}
                                                    </IconButton>
                                                );
                                            })}
                                        </Box>
                                    </Box>
                                </ListItem>
                            );
                        })
                    )}
                </List>
            </Box>
        </Box>
    );
};
