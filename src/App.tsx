import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { JapaCounter } from './components/JapaCounter';
import { ReportView } from './components/ReportView';
import { CommunityView } from './components/CommunityView'; // Kept as "Pledges" View
import { ProfileView } from './components/ProfileView';
import { CommunityListPage } from './components/pages/CommunityListPage';
import { CommunityCreatePage } from './components/pages/CommunityCreatePage';
import { CommunityHomePage } from './components/pages/CommunityHomePage';
import { NotificationsPage } from './components/pages/NotificationsPage';
import { Globe2, Home, User, Users, Bell, Shield } from 'lucide-react';
import { Pledge } from './types/pledge';
import { Box, Paper, BottomNavigation, BottomNavigationAction, IconButton, Badge } from '@mui/material';
import { CommunityProvider } from './contexts/CommunityContext';
import { useAuth } from './contexts/AuthContext';

// Lazy load admin
import { lazy, Suspense } from 'react';
const AdminPanel = lazy(() => import('./admin/AdminPanel').then(m => ({ default: m.AdminPanel })));


function App() {
    // Auth
    const { authUser } = useAuth();
    
    // Extended View State
    const [view, setView] = useState<'counter' | 'report' | 'pledges' | 'communities' | 'profile' | 'community-create' | 'community-home' | 'notifications' | 'admin'>('counter');
    const [activePledge, setActivePledge] = useState<Pledge | null>(null);
    const [activeCommunityId, setActiveCommunityId] = useState<string | null>(null);

    const handleSelectPledge = (pledge: Pledge) => {
        setActivePledge(pledge);
        setView('counter');
    };

    const handleViewReport = () => setView('report');

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
                {['counter', 'pledges', 'communities', 'profile'].includes(view) && (
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
                                    onViewReport={handleViewReport}
                                    activePledge={activePledge}
                                />
                            </motion.div>
                        )}

                        {view === 'report' && (
                            <motion.div
                                key="report"
                                initial={{ x: 300, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: 300, opacity: 0 }}
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, zIndex: 60, backgroundColor: 'white' }}
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
                                <CommunityView
                                    onBack={() => setView('counter')}
                                    onSelectPledge={handleSelectPledge}
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
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, zIndex: 10, backgroundColor: 'white' }}
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
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, zIndex: 10, backgroundColor: 'white' }}
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
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, zIndex: 60, backgroundColor: 'white' }}
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
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, zIndex: 100, backgroundColor: 'white' }}
                            >
                                <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>Loading Admin...</Box>}>
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
                            <BottomNavigationAction label="Counter" value="counter" icon={<Home />} />
                            <BottomNavigationAction label="Pledges" value="pledges" icon={<Globe2 />} />
                            <BottomNavigationAction label="Groups" value="communities" icon={<Users />} />
                            <BottomNavigationAction label="Profile" value="profile" icon={<User />} />
                            {authUser?.role === 'superadmin' && (
                                <BottomNavigationAction label="Admin" value="admin" icon={<Shield />} />
                            )}
                        </BottomNavigation>
                    </Paper>
                )}
            </Box>
        </CommunityProvider>
    );
}

export default App;
