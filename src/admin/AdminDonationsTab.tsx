import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert } from '@mui/material';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { runWithFallback } from '../services/resilience';
import { Donation } from '../types/monetization';

export const AdminDonationsTab: React.FC = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRaised, setTotalRaised] = useState(0);

  useEffect(() => {
    fetchDonations();
  }, []);

  const fetchDonations = async () => {
    try {
      setLoading(true);
      const donationsRef = collection(db, 'donations');
      const q = query(donationsRef, orderBy('createdAt', 'desc'), limit(100));
      
      const querySnapshot = await runWithFallback(
        () => getDocs(q),
        async () => { return { forEach: () => {} } as any; },
        'Fetch Donations'
      );

      let total = 0;
      const fetched: Donation[] = [];
      
      querySnapshot.forEach((doc: any) => {
        const data = doc.data() as Donation;
        fetched.push({ ...data, id: doc.id });
        if (data.status === 'successful') {
          total += data.amount;
        }
      });
      
      setDonations(fetched);
      setTotalRaised(total);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching donations:', err);
      setError('Failed to load donations. You might be offline.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" fontWeight="bold">Recent Donations</Typography>
        <Paper elevation={0} sx={{ p: 2, bgcolor: '#FFFBF0', border: '1px solid #FCD34D' }}>
          <Typography variant="caption" color="text.secondary" display="block">Total Raised</Typography>
          <Typography variant="h5" fontWeight="bold" color="#F59E0B">
            ₹{totalRaised}
          </Typography>
        </Paper>
      </Box>

      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #E5E7EB' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F9FAFB' }}>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>User ID</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Order ID</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {donations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No donations found
                </TableCell>
              </TableRow>
            ) : (
              donations.map((donation) => (
                <TableRow key={donation.id} hover>
                  <TableCell>
                    {donation.createdAt?.toDate ? donation.createdAt.toDate().toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                    {donation.userId}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'medium' }}>
                    ₹{donation.amount}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={donation.status} 
                      size="small"
                      color={donation.status === 'successful' ? 'success' : donation.status === 'failed' ? 'error' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'text.secondary' }}>
                    {donation.razorpayOrderId || 'N/A'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
