import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { JapaCounter } from './components/JapaCounter';
import { ReportView } from './components/ReportView';
import { CommunityView } from './components/CommunityView';
import { ProfileView } from './components/ProfileView';
import { Globe2, Home, User } from 'lucide-react';
import { Pledge } from './services/community';
import { Box, Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { CommunityProvider } from './contexts/CommunityContext';


function App() {
    const [view, setView] = useState<'counter' | 'report' | 'community' | 'profile'>('counter');
    const [activePledge, setActivePledge] = useState<Pledge | null>(null);

    const handleSelectPledge = (pledge: Pledge) => {
        setActivePledge(pledge);
        setView('counter');
    };

    const handleViewReport = () => setView('report');
    const handleBack = () => setView('counter');

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
                                style={{ width: '100%', height: '100%', position: 'absolute', top: 0, zIndex: 10, background: 'white' }}
                            >
                                <ReportView onBack={handleBack} />
                            </motion.div>
                        )}

                        {view === 'community' && (
                            <motion.div
                                key="community"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ width: '100%', height: '100%' }}
                            >
                                <CommunityView
                                    onBack={handleBack}
                                    onSelectPledge={handleSelectPledge}
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
                                    onNavigateToCommunity={() => setView('community')}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </Box>

                {/* Bottom Navigation */}
                {view !== 'report' && (
                    <Paper sx={{ zIndex: 20, width: '100%' }} elevation={3}>
                        <BottomNavigation
                            showLabels
                            value={view}
                            onChange={(_event, newValue) => {
                                setView(newValue);
                            }}
                            sx={{ height: 80, pb: 2 }}
                        >
                            <BottomNavigationAction label="Counter" value="counter" icon={<Home />} />
                            <BottomNavigationAction label="Community" value="community" icon={<Globe2 />} />
                            <BottomNavigationAction label="Profile" value="profile" icon={<User />} />
                        </BottomNavigation>
                    </Paper>
                )}
            </Box>
        </CommunityProvider>
    );
}

export default App;
