import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { JapaCounter } from './components/JapaCounter';
import { ReportView } from './components/ReportView';
import { PledgesView } from './components/PledgesView';
import { ProfileView } from './components/ProfileView';
import { GuestJapaView } from './components/GuestJapaView';
import { CommunityListPage } from './components/pages/CommunityListPage';
import { CommunityCreatePage } from './components/pages/CommunityCreatePage';
import { CommunityHomePage } from './components/pages/CommunityHomePage';
import { NotificationsPage } from './components/pages/NotificationsPage';
import { Flame, Home, User, Users, Bell, Shield } from 'lucide-react';
import { Pledge, PersonalPledge } from './types/pledge';
import { Box, Paper, BottomNavigation, BottomNavigationAction, IconButton, Badge } from '@mui/material';
import { CommunityProvider } from './contexts/CommunityContext';
import { useAuth } from './contexts/AuthContext';

// Lazy load admin
import { lazy, Suspense } from 'react';
const AdminPanel = lazy(() => import('./admin/AdminPanel').then(m => ({ default: m.AdminPanel })));


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
    
    // Extended View State
    const [view, setView] = useState<'counter' | 'report' | 'pledges' | 'communities' | 'profile' | 'community-create' | 'community-home' | 'notifications' | 'admin'>('counter');
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
    const handleNavigate = (newView: any, param?: any) => {
        if (newView === 'community-home' && param) {
            setActiveCommunityId(param);
        }
        if (newView === 'admin' && authUser?.role !== 'superadmin') {
            console.warn("Unauthorized access to admin panel");
            setView('counter');
            return;
        }
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
            <CommunityProvider>
                <GuestJapaView pledgeId={guestPledgeId} />
            </CommunityProvider>
        );
    }

    return (
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
                            onClick={() => setView('notifications')}
                            sx={{ bgcolor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', '&:hover': { bgcolor: 'white' } }}
                        >
                            <Badge color="error" variant="dot">
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
                                <ReportView onBack={handleBack} />
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
                                <PledgesView
                                    onSelectPledge={handleSelectPledge}
                                    onSelectPersonalPledge={handleSelectPersonalPledge}
                                    completedPledge={completedPersonalPledge}
                                    onCelebrationDismiss={() => setCompletedPersonalPledge(null)}
                                />
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
                                <CommunityListPage onNavigate={handleNavigate} />
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
                                <CommunityCreatePage
                                    onBack={() => setView('communities')}
                                    onCreated={(id) => { setActiveCommunityId(id); setView('community-home'); }}
                                />
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
                                <CommunityHomePage
                                    communityId={activeCommunityId}
                                    onBack={() => setView('communities')}
                                />
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
                                <NotificationsPage
                                    onBack={() => setView('counter')}
                                    onNavigate={handleNavigate}
                                />
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
                                <ProfileView
                                    onSelectPledge={handleSelectPledge}
                                    onNavigateToCommunity={() => setView('pledges')} // Or communities? Keep pledges for now.
                                />
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
        </CommunityProvider>
    );
}

export default App;
