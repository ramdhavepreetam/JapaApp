import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, IconButton, CircularProgress, Alert
} from '@mui/material';
import { Users, Globe2, CircleDashed, Heart, RefreshCw } from 'lucide-react';
import { adminService } from '../services/adminService';

export const AdminStatsTab: React.FC = () => {
  const [stats, setStats] = useState<{ totalUsers: number, totalMalas: number, activeCommunities: number, totalDonations: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAppStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch platform metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Platform Metrics</Typography>
        <IconButton onClick={fetchStats} disabled={loading} color="primary">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </IconButton>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3 }}>
        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Users size={40} className="mb-2 opacity-80" />
          <Typography variant="h4" fontWeight="bold">
            {stats?.totalUsers.toLocaleString() || '0'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Users</Typography>
        </Paper>

        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'secondary.light', color: 'secondary.contrastText' }}>
          <Globe2 size={40} className="mb-2 opacity-80" />
          <Typography variant="h4" fontWeight="bold">
            {stats?.activeCommunities.toLocaleString() || '0'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>Active Communities</Typography>
        </Paper>

        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'success.light', color: 'success.contrastText' }}>
          <CircleDashed size={40} className="mb-2 opacity-80" />
          <Typography variant="h4" fontWeight="bold">
            {stats?.totalMalas.toLocaleString() || '0'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Malas Chanted</Typography>
        </Paper>

        <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          <Heart size={40} className="mb-2 opacity-80" />
          <Typography variant="h4" fontWeight="bold">
            ₹{stats?.totalDonations.toLocaleString() || '0'}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Donations</Typography>
        </Paper>
      </Box>
    </Box>
  );
};
