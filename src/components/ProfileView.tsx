import React, { useEffect, useState } from 'react';
import { Box, Typography, Avatar, Paper, IconButton, Button, CircularProgress } from '@mui/material';
import { Settings, LogOut, Award, Flame, History } from 'lucide-react';
import { useTheme } from '@mui/material/styles';
import { useAuth } from '../contexts/AuthContext';
import { Pledge, communityService } from '../services/community';
import { userService, UserProfile } from '../services/userService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PledgeCard } from './PledgeCard';
import { useCommunity } from '../contexts/CommunityContext';

interface ProfileViewProps {
    onSelectPledge: (pledge: Pledge) => void;
    onNavigateToCommunity: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onSelectPledge, onNavigateToCommunity }) => {
    const theme = useTheme();
    const { user, logout, signInWithGoogle } = useAuth();
    const { myPledges, pledges, loading: loadingPledges } = useCommunity(); // Consume global cache

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);
    // pledges state is now derived from context

    useEffect(() => {
        let unsubscribe: () => void;
        // Future: listen to my pledges real-time?
        // For now, onSnapshot is a bit complex for a query in useEffect without a custom hook, 
        // let's stick to fetch-on-load for pledges or simple real-time if easy.

        const loadProfileListener = async () => {
            if (user) {
                setLoading(true);
                try {
                    // 1. Profile Listener
                    unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docPic) => {
                        setLoading(false);
                        if (docPic.exists()) {
                            setProfile(docPic.data() as UserProfile);
                        } else {
                            // OPTIMIZED: Create profile immediately without reading again
                            userService.createProfile(user).then(p => setProfile(p));
                        }
                    }, (error) => {
                        console.error("Profile listener error", error);
                        setLoading(false);
                    });

                    // 2. My Pledges are now handled by CommunityContext!
                    // We just consume `myPledges` from the hook.

                } catch (error) {
                    console.error("Failed to setup profile listener", error);
                    setLoading(false);
                }
            } else {
                setProfile(null);
            }
        };

        loadProfileListener();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [user]);



    if (!user) {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
                <Avatar sx={{ width: 80, height: 80, bgcolor: 'primary.light', mb: 3 }}>
                    <Settings size={40} />
                </Avatar>
                <Typography variant="h5" gutterBottom fontWeight="bold">Guest Mode</Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                    Sign in to track your stats, join communities, and save your progress to the cloud.
                </Typography>
                <Button
                    variant="contained"
                    size="large"
                    onClick={signInWithGoogle}
                    sx={{ mt: 2, borderRadius: 8, px: 4 }}
                >
                    Sign In with Google
                </Button>
            </Box>
        );
    }

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto' }}>
            {/* Header / Profile Card */}
            <Paper
                elevation={0}
                sx={{
                    p: 4,
                    pb: 6,
                    borderRadius: '0 0 32px 32px',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    position: 'relative',
                    mb: 2
                }}
            >
                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                    <IconButton size="small" sx={{ color: 'white/70' }}>
                        <Settings size={20} />
                    </IconButton>
                </Box>

                <Avatar
                    src={user.photoURL || undefined}
                    sx={{
                        width: 80,
                        height: 80,
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        fontSize: 32,
                        fontWeight: 'bold',
                        mb: 2,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                    }}
                >
                    {user.displayName?.[0] || 'S'}
                </Avatar>

                <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'serif' }}>
                    {user.displayName || 'Sadhaka'}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, letterSpacing: 1 }}>
                    MEMBER SINCE {profile?.joinedAt ? new Date(profile.joinedAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '...'}
                </Typography>

                {/* Stats Row */}
                <Box sx={{ display: 'flex', gap: 2, mt: 3, maxWidth: 400, width: '100%' }}>
                    <Box sx={{ flex: 1, bgcolor: 'white/10', p: 2, borderRadius: 3, textAlign: 'center', backdropFilter: 'blur(4px)' }}>
                        <Flame size={20} className="text-gold-400" style={{ marginBottom: 4, color: '#FCD34D' }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{profile?.stats.streakDays || 0}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>DAY STREAK</Typography>
                    </Box>
                    <Box sx={{ flex: 1, bgcolor: 'white/10', p: 2, borderRadius: 3, textAlign: 'center', backdropFilter: 'blur(4px)' }}>
                        <Award size={20} style={{ marginBottom: 4, color: '#FCD34D' }} />
                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>{profile?.stats.totalMalas || 0}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>TOTAL MALAS</Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Active Pledges */}
            <Box sx={{ px: 3, pb: 4 }}>
                <Typography variant="h6" color="primary.dark" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <History size={20} /> My Pledges
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {loadingPledges ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : myPledges.length > 0 ? (
                        myPledges.map(mp => {
                            // Find global pledge data for shared stats (participants)
                            // We use the global 'pledges' list from context
                            const globalPledge = pledges.find(p => p.id === mp.pledgeId);

                            // Construct display object for Card
                            // distinct: currentMalas is GLOBAL now (consistent with interface), myContribution passed separately
                            const displayPledge: Pledge = {
                                id: mp.pledgeId,
                                title: mp.pledgeTitle,
                                description: globalPledge?.description || '',
                                targetMalas: mp.pledgeTarget,
                                currentMalas: globalPledge?.currentMalas || 0, // Global count
                                participants: globalPledge?.participants || 0,
                                mantra: globalPledge?.mantra
                            };

                            const handleLeave = async (pledge: Pledge) => {
                                if (!user) return;
                                if (window.confirm("Are you sure you want to leave this cause?")) {
                                    try {
                                        setLoading(true);
                                        await communityService.leavePledge(pledge.id, user.uid);
                                        setLoading(false);
                                    } catch (e) {
                                        console.error(e);
                                        setLoading(false);
                                    }
                                }
                            };

                            return (
                                <PledgeCard
                                    key={mp.id}
                                    pledge={displayPledge}
                                    isJoined={true}
                                    onJoin={() => onSelectPledge(displayPledge)}
                                    onLeave={() => handleLeave(displayPledge)}
                                    myContribution={mp.contributedMalas} // Explicit personal stats
                                />
                            );
                        })
                    ) : (
                        <Paper sx={{ p: 3, textAlign: 'center', border: '1px dashed', borderColor: 'divider', bgcolor: 'transparent' }}>
                            <Typography variant="body2" color="text.secondary">
                                You haven't joined any community pledges yet.
                            </Typography>
                            <Button variant="text" onClick={onNavigateToCommunity} sx={{ mt: 1 }}>
                                Explore Community
                            </Button>
                        </Paper>
                    )}
                </Box>
            </Box>

            <Box sx={{ p: 3, mt: 'auto', pb: 12 }}>
                <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    startIcon={<LogOut size={18} />}
                    onClick={logout}
                    sx={{ borderRadius: 3, textTransform: 'none', borderColor: 'error.main' }}
                >
                    Sign Out
                </Button>
            </Box>
        </Box>
    );
};
