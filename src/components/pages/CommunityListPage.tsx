import React, { useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Tab,
    Tabs,
    InputAdornment,
    TextField,
    Card,
    Button,
    Chip,
    CircularProgress,
    Fab,
    Stack
} from '@mui/material';
import { Search, Plus, Users, Shield, Globe2, Ticket } from 'lucide-react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { communityService } from '../../services/communityService';
import { notificationService } from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import { Community } from '../../types/community';

interface CommunityListPageProps {
    onNavigate: (view: any, communityId?: string) => void;
}

export const CommunityListPage: React.FC<CommunityListPageProps> = ({ onNavigate }) => {
    const { user } = useAuth();
    const [tab, setTab] = useState(0);
    const [search, setSearch] = useState('');

    // Invite Dialog State
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [joining, setJoining] = useState(false);

    const [myCommunities, setMyCommunities] = useState<Community[]>([]);
    const [unreadMap, setUnreadMap] = useState<Record<string, boolean>>({});
    const [discoverCommunities, setDiscoverCommunities] = useState<Community[]>([]);
    const [loading, setLoading] = useState(true);

    // Load data
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                if (user) {
                    const members = await communityService.getMyCommunities(user.uid);
                    const details = await Promise.all(
                        members.map(m => communityService.getCommunity(m.communityId))
                    );
                    setMyCommunities(details.filter(c => c !== null) as Community[]);

                    // Check for unread announcements
                    const newUnreadMap: Record<string, boolean> = {};
                    await Promise.all(members.map(async (m) => {
                        const latestTime = await notificationService.getLatestAnnouncementTime(m.communityId);
                        if (latestTime) {
                            // If lastRead is null/undefined, effectively unread if announcement exists
                            const lastRead = m.lastReadAnnouncementsAt; // Type updated in communityService
                            if (!lastRead || latestTime.toMillis() > lastRead.toMillis()) {
                                newUnreadMap[m.communityId] = true;
                            }
                        }
                    }));
                    setUnreadMap(newUnreadMap);
                }

                // Initial Discovery (No search)
                if (!search) {
                    const result = await communityService.discoverCommunities(20);
                    setDiscoverCommunities(result.communities);
                }
            } catch (e) {
                console.error("Failed to load communities", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user, search === '']); // Reload when search cleared

    // Debounced Search Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (search.trim().length > 0) {
                setLoading(true);
                try {
                    // Switch to Discover tab if searching
                    if (tab === 0) setTab(1);

                    const results = await communityService.searchCommunities(search);
                    setDiscoverCommunities(results);
                } catch (e) {
                    console.error("Search failed", e);
                } finally {
                    setLoading(false);
                }
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    const handleCreate = () => {
        onNavigate('community-create');
    };


    const handleJoinWithCode = async () => {
        if (!inviteCode.trim()) return;

        if (!user) {
            alert("Please sign in to join a community.");
            return;
        }

        setJoining(true);
        try {
            await communityService.joinWithInviteCode(inviteCode.trim(), {
                uid: user.uid,
                displayName: user.displayName || 'User',
                photoURL: user.photoURL || ''
            });
            setInviteDialogOpen(false);
            setInviteCode('');
            // Reload user communities
            const members = await communityService.getMyCommunities(user.uid);
            const details = await Promise.all(
                members.map(m => communityService.getCommunity(m.communityId))
            );
            setMyCommunities(details.filter(c => c !== null) as Community[]);
            setTab(0); // Go to My Communities
        } catch (e: any) {
            alert(e.message || "Failed to join");
        } finally {
            setJoining(false);
        }
    };

    // Client-side filter for My Communities only
    const filteredMy = myCommunities.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    // Discover list is now driven by server state (discoverCommunities) directly
    const displayedDiscover = discoverCommunities;

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            {/* Header */}
            <Box sx={{ p: 2, bgcolor: 'background.paper', position: 'sticky', top: 0, zIndex: 10, boxShadow: 1 }}>

                <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                    <Users className="text-orange-600" /> Communities
                </Typography>
                <Button
                    size="small"
                    startIcon={<Ticket size={16} />}
                    onClick={() => setInviteDialogOpen(true)}
                    sx={{ position: 'absolute', right: 16, top: 16 }}
                >
                    Have a code?
                </Button>

                <TextField
                    fullWidth
                    placeholder="Search communities..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="small"
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><Search size={18} /></InputAdornment>,
                        sx: { borderRadius: 4, bgcolor: 'background.default' }
                    }}
                />

                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="fullWidth"
                    sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label="My Communities" />
                    <Tab label="Discover" />
                </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2, position: 'relative' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={tab}
                            initial={{ opacity: 0, x: tab === 0 ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: tab === 0 ? 20 : -20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <Stack spacing={2}>
                                {(tab === 0 ? filteredMy : displayedDiscover).map(community => (
                                    <CommunityCard
                                        key={community.id}
                                        community={community}
                                        onClick={() => onNavigate('community-home', community.id)}
                                        isJoined={tab === 0}
                                        hasUnread={unreadMap[community.id] || false}
                                    />
                                ))}

                                {tab === 0 && filteredMy.length === 0 && (
                                    <Box sx={{ width: '100%', textAlign: 'center', mt: 4, opacity: 0.7 }}>
                                        <Users size={48} style={{ marginBottom: 16 }} />
                                        <Typography>You haven't joined any communities yet.</Typography>
                                        <Button onClick={() => setTab(1)} sx={{ mt: 1 }}>Discover New Groups</Button>
                                    </Box>
                                )}
                            </Stack>
                        </motion.div>
                    </AnimatePresence>
                )}
            </Box>

            {/* Floating Action Button */}
            {user && (
                <Fab
                    color="primary"
                    sx={{ position: 'absolute', bottom: 24, right: 24 }}
                    onClick={handleCreate}
                >
                    <Plus />
                </Fab>
            )}

            {/* Invite Code Dialog */}
            <Dialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)}>
                <DialogTitle>Join with Invite Code</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        Enter the 6-character code shared by the community admin.
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Invite Code"
                        fullWidth
                        variant="outlined"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        inputProps={{ maxLength: 6, style: { fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center' } }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleJoinWithCode} variant="contained" disabled={joining || inviteCode.length < 3}>
                        {joining ? "Joining..." : "Join Community"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

const CommunityCard: React.FC<{ community: Community, onClick: () => void, isJoined: boolean, hasUnread?: boolean }> = ({ community, onClick, isJoined, hasUnread }) => {
    return (
        <Card
            onClick={onClick}
            elevation={1}
            sx={{
                display: 'flex',
                borderRadius: 3,
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.1s',
                '&:active': { transform: 'scale(0.98)' }
            }}
        >
            <Box
                sx={{
                    width: 80,
                    bgcolor: 'primary.light',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.dark',
                    position: 'relative'
                }}
            >
                {hasUnread && (
                    <Box sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        width: 10,
                        height: 10,
                        bgcolor: 'error.main',
                        borderRadius: '50%',
                        zIndex: 2,
                        border: '2px solid white'
                    }} />
                )}
                {community.imageUrl ? (
                    <img src={community.imageUrl} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Globe2 size={32} />
                )}
            </Box>
            <Box sx={{ flex: 1, p: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {community.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ mb: 1 }}>
                    {community.membersCount} members · {community.totalMalas} malas
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {community.isPrivate && (
                        <Chip icon={<Shield size={12} />} label="Private" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                    {isJoined && (
                        <Chip label="Joined" size="small" color="secondary" sx={{ height: 20, fontSize: '0.65rem' }} />
                    )}
                </Box>
            </Box>
        </Card>
    );
};
