import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { JapaCounter } from './components/JapaCounter';
import { GuestJapaView } from './components/GuestJapaView';
import { MilestoneCelebration } from './components/MilestoneCelebration';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import { Flame, Home, User, Users, Bell, Shield } from 'lucide-react';
import { Pledge, PersonalPledge } from './types/pledge';
import { Box, Paper, BottomNavigation, BottomNavigationAction, IconButton, Badge, CircularProgress } from '@mui/material';
import { CommunityProvider } from './contexts/CommunityContext';
import { useAuth } from './contexts/AuthContext';
import { communityService } from './services/communityService';
import { notificationService } from './services/notificationService';
import { storage } from './lib/storage';
import { getRankForJaps, isMilestoneSeen, markMilestoneSeen, Rank } from './lib/ranks';
import { getThemeForRank } from './theme';

// Lazy load views that aren't shown on first paint — keeps the initial bundle
// small since `view` always starts at 'counter' (JapaCounter stays eager).
import { lazy, Suspense } from 'react';
const AdminPanel = lazy(() => import('./admin/AdminPanel').then(m => ({ default: m.AdminPanel })));
const ReportView = lazy(() => import('./components/ReportView').then(m => ({ default: m.ReportView })));
const PledgesView = lazy(() => import('./components/PledgesView').then(m => ({ default: m.PledgesView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));
const CommunityListPage = lazy(() => import('./components/pages/CommunityListPage').then(m => ({ default: m.CommunityListPage })));
const CommunityCreatePage = lazy(() => import('./components/pages/CommunityCreatePage').then(m => ({ default: m.CommunityCreatePage })));
const CommunityHomePage = lazy(() => import('./components/pages/CommunityHomePage').then(m => ({ default: m.CommunityHomePage })));
const NotificationsPage = lazy(() => import('./components/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

const ViewLoadingFallback = () => (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress size={28} />
    </Box>
);


function App() {
    // Auth
    const { authUser } = useAuth();
    const { t, i18n } = useTranslation();

    // Guest QR pledge landing — detect ?pledge=ID on mount (never changes during session)
    const guestPledgeId = useMemo(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('pledge');
    }, []);

    // Apply lang attribute to <html> for CSS :lang() selector
    useEffect(() => {
        document.documentElement.lang = i18n.language?.startsWith('hi') ? 'hi' : 'en';
    }, [i18n.language]);
    
    // Rank & theme
    const [currentRank, setCurrentRank] = useState<Rank>(() => getRankForJaps(storage.get().totalCounts));
    const appTheme = useMemo(() => getThemeForRank(currentRank.themeKey), [currentRank.themeKey]);
    const [pendingCelebration, setPendingCelebration] = useState<Rank | null>(null);

    const handleRankChange = useCallback((r: Rank) => setCurrentRank(prev => prev.id === r.id ? prev : r), []);
    const handleMilestoneReached = useCallback((r: Rank) => setPendingCelebration(r), []);

    // Show celebration once for users who already have a high rank (e.g. after app upgrade)
    useEffect(() => {
        const rank = getRankForJaps(storage.get().totalCounts);
        if (rank.thresholdJaps > 0 && !isMilestoneSeen(rank.id)) {
            setPendingCelebration(rank);
            markMilestoneSeen(rank.id);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Notification unread badge
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshUnreadCount = useCallback(async () => {
        if (!authUser) return;
        try {
            const myComms = await communityService.getMyCommunities(authUser.uid);
            const ids = myComms.map(c => c.communityId);
            const count = await notificationService.getUnreadCount(authUser.uid, ids);
            setUnreadCount(count);
        } catch { /* non-fatal */ }
    }, [authUser]);

    useEffect(() => {
        refreshUnreadCount();
    }, [refreshUnreadCount]);

    // Extended View State
    type AppView = 'counter' | 'report' | 'pledges' | 'communities' | 'profile' | 'community-create' | 'community-home' | 'notifications' | 'admin';
    const [view, setView] = useState<AppView>('counter');
    const [previousView, setPreviousView] = useState<AppView>('counter');
    const [activePledge, setActivePledge] = useState<Pledge | null>(null);
    const [activePersonalPledge, setActivePersonalPledge] = useState<PersonalPledge | null>(null);
    const [completedPersonalPledge, setCompletedPersonalPledge] = useState<PersonalPledge | null>(null);
    const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);

    const handleSelectPledge = (pledge: Pledge) => {
        setActivePledge(pledge);
        setActivePersonalPledge(null);
        setView('counter');
    };

    const handleSelectPersonalPledge = (pledge: PersonalPledge) => {
        setActivePersonalPledge(pledge);
        setActivePledge(null);
        setView('counter');
    };

    const handlePersonalPledgeComplete = (pledge: PersonalPledge) => {
        setActivePersonalPledge(null);
        setCompletedPersonalPledge(pledge);
        setView('pledges');
    };

    // Unused params are fine in JS/TS if not strict-strict about args, but let's use them to avoid linter
    const handleNavigate = (newView: AppView, param?: any) => {
        if (newView === 'community-home' && param) {
            setActiveCommunityId(param);
        }
        if (newView === 'admin' && authUser?.role !== 'superadmin') {
            console.warn("Unauthorized access to admin panel");
            setView('counter');
            return;
        }
        setPreviousView(view);
        setView(newView);
    };

    const handleBack = () => setView('counter');

    // Helper to get main nav value
    const getNavValue = () => {
        if (['counter', 'report'].includes(view)) return 'counter';
        if (['pledges'].includes(view)) return 'pledges'; // Old Community View
        if (['communities', 'community-create', 'community-home'].includes(view)) return 'communities';
        if (view === 'profile') return 'profile';
        if (view === 'admin') return 'admin';
        return 'counter';
    };

    // Render lightweight guest view when user arrived via a pledge QR code
    if (guestPledgeId) {
        return (
            <ThemeProvider theme={appTheme}>
                <CssBaseline />
                <CommunityProvider>
                    <GuestJapaView pledgeId={guestPledgeId} />
                </CommunityProvider>
                <PwaUpdatePrompt />
            </ThemeProvider>
        );
    }

    return (
        <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <CommunityProvider>
            <Box sx={{
                height: '100dvh',
                width: '100%',
                bgcolor: 'background.default',
                color: 'text.primary',
                overflow: 'hidden',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Global Notification Bell (Overlay) - Only show on main views */}
                {['pledges', 'communities', 'profile'].includes(view) && (
                    <Box sx={{ position: 'absolute', top: 16, right: 16, zIndex: 50 }}>
                        <IconButton
                            onClick={() => { setPreviousView(view); setView('notifications'); setUnreadCount(0); }}
                            aria-label={t('nav.notifications')}
                            sx={{ bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', '&:hover': { bgcolor: 'white' } }}
                        >
                            <Badge color="error" badgeContent={unreadCount} max={9}>
                                <Bell size={20} className="text-gray-700" />
                            </Badge>
                        </IconButton>
                    </Box>
                )}

                <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                    <AnimatePresence mode="wait">
                        {view === 'counter' && (
                            <motion.div
                                key="counter"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <JapaCounter
                                    activePledge={activePledge}
                                    activePersonalPledge={activePersonalPledge}
                                    onPersonalPledgeComplete={handlePersonalPledgeComplete}
                                    onRankChange={handleRankChange}
                                    onMilestoneReached={handleMilestoneReached}
                                />
                            </motion.div>
                        )}

                        {view === 'report' && (
                            <motion.div
                                key="report"
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 300, opacity: 0 }}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'white' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <ReportView onBack={handleBack} />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'pledges' && (
                            <motion.div
                                key="pledges"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <PledgesView
                                        onSelectPledge={handleSelectPledge}
                                        onSelectPersonalPledge={handleSelectPersonalPledge}
                                        completedPledge={completedPersonalPledge}
                                        onCelebrationDismiss={() => setCompletedPersonalPledge(null)}
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'communities' && (
                            <motion.div
                                key="communities"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <CommunityListPage onNavigate={handleNavigate} />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'community-create' && (
                            <motion.div
                                key="community-create"
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'white' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <CommunityCreatePage
                                        onBack={() => setView('communities')}
                                        onCreated={(id) => { setActiveCommunityId(id); setView('community-home'); }}
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'community-home' && activeCommunityId && (
                            <motion.div
                                key="community-home"
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, backgroundColor: 'white' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <CommunityHomePage
                                        communityId={activeCommunityId}
                                        onBack={() => setView('communities')}
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'notifications' && (
                            <motion.div
                                key="notifications"
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: 'white' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <NotificationsPage
                                        onBack={() => setView(previousView)}
                                        onNavigate={handleNavigate}
                                        onRead={refreshUnreadCount}
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'profile' && (
                            <motion.div
                                key="profile"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <Suspense fallback={<ViewLoadingFallback />}>
                                    <ProfileView
                                        onSelectPledge={handleSelectPledge}
                                        onNavigateToCommunity={() => setView('pledges')} // Or communities? Keep pledges for now.
                                    />
                                </Suspense>
                            </motion.div>
                        )}

                        {view === 'admin' && authUser?.role === 'superadmin' && (
                            <motion.div
                                key="admin"
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: 'white' }}
                            >
                                <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>{t('nav.admin')}...</Box>}>
                                    <AdminPanel onBack={() => setView('profile')} />
                                </Suspense>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>

                {/* Bottom Navigation */}
                {view !== 'report' && !['community-create', 'community-home', 'notifications'].includes(view) && (
                    <Paper sx={{ zIndex: 20, width: '100%' }} elevation={3}>
                        <BottomNavigation
                            showLabels
                            value={getNavValue()}
                            onChange={(_event, newValue) => {
                                handleNavigate(newValue);
                            }}
                            sx={{ height: 80, pb: 2 }}
                        >
                            <BottomNavigationAction label={t('nav.counter')} value="counter" icon={<Home />} />
                            <BottomNavigationAction label={t('nav.pledges')} value="pledges" icon={<Flame />} />
                            <BottomNavigationAction label={t('nav.groups')} value="communities" icon={<Users />} />
                            <BottomNavigationAction label={t('nav.profile')} value="profile" icon={<User />} />
                            {authUser?.role === 'superadmin' && (
                                <BottomNavigationAction label={t('nav.admin')} value="admin" icon={<Shield />} />
                            )}
                        </BottomNavigation>
                    </Paper>
                )}
            </Box>
            <MilestoneCelebration rank={pendingCelebration} onDismiss={() => setPendingCelebration(null)} />
        </CommunityProvider>
        <PwaUpdatePrompt />
        </ThemeProvider>
    );
}

export default App;
