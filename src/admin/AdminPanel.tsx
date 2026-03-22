import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Paper, Tabs, Tab, Alert } from '@mui/material';
import { ArrowLeft, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

import { AdminUsersTab } from './AdminUsersTab';
import { AdminCommunitiesTab } from './AdminCommunitiesTab';
import { AdminPledgesTab } from './AdminPledgesTab';
import { AdminStatsTab } from './AdminStatsTab';
import { AdminDonationsTab } from './AdminDonationsTab';
import { AdminMantrasTab } from './AdminMantrasTab';

interface AdminPanelProps {
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const { authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <Box sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={onBack} sx={{ mr: 2 }}>
            <ArrowLeft />
          </IconButton>
          <Typography variant="h5" fontWeight="bold">Admin Panel</Typography>
        </Box>
        <Alert severity="error" variant="filled">
          Admin panel requires live internet connection. Please connect and try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Saffron Header */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          bgcolor: '#F59E0B', 
          color: 'white',
          borderRadius: 0 
        }}
      >
        <IconButton onClick={onBack} sx={{ color: 'white', mr: 2 }}>
          <ArrowLeft />
        </IconButton>
        <Shield size={24} style={{ marginRight: 8 }} />
        <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
          Admin Panel
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>
          {authUser?.displayName || 'Super Admin'}
        </Typography>
      </Paper>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
        <Tabs 
          value={activeTab} 
          onChange={(_, newVal) => setActiveTab(newVal)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Users" />
          <Tab label="Communities" />
          <Tab label="Pledges" />
          <Tab label="Stats" />
          <Tab label="Donations" />
          <Tab label="Mantras" />
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative', p: 2 }}>
        <AnimatePresence mode="wait">
          {activeTab === 0 && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ height: '100%' }}
            >
              <AdminUsersTab />
            </motion.div>
          )}
          {activeTab === 1 && (
            <motion.div
              key="communities"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ height: '100%' }}
            >
              <AdminCommunitiesTab />
            </motion.div>
          )}
          {activeTab === 2 && (
            <motion.div
              key="pledges"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ height: '100%' }}
            >
              <AdminPledgesTab />
            </motion.div>
          )}
          {activeTab === 3 && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ height: '100%' }}
            >
              <AdminStatsTab />
            </motion.div>
          )}
          {activeTab === 4 && (
            <motion.div
              key="donations"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ height: '100%' }}
            >
              <AdminDonationsTab />
            </motion.div>
          )}
          {activeTab === 5 && (
            <motion.div
              key="mantras"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{ height: '100%' }}
            >
              <AdminMantrasTab />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
};
