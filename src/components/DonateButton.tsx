import React, { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, Box, Typography, TextField, CircularProgress, Alert } from '@mui/material';
import { Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { donationService } from '../services/donationService';

interface DonateButtonProps {
  variant?: 'text' | 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export const DonateButton: React.FC<DonateButtonProps> = ({ variant = 'contained', size = 'medium', fullWidth }) => {
  const { authUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(108); // Default to sacred number
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predefinedAmounts = [51, 108, 1008];

  const handleDonate = async () => {
    if (!authUser) {
      setError('Please sign in to donate.');
      return;
    }

    if (amount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await donationService.createOrder({
        amount: amount * 100, // Convert to paise
        onSuccess: () => {
          setLoading(false);
          setOpen(false);
          console.log('Donation successful!');
        },
        onError: (err: any) => {
          setLoading(false);
          setError(err.description || 'Payment failed. Please try again.');
        }
      });
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Error initializing payment.');
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => setOpen(true)}
        startIcon={<Heart size={18} />}
        sx={{
          bgcolor: variant === 'contained' ? 'warning.main' : undefined,
          color: variant === 'contained' ? 'white' : 'warning.main',
          '&:hover': variant === 'contained' ? { bgcolor: 'warning.dark' } : undefined
        }}
      >
        Donate
      </Button>

      <Dialog open={open} onClose={() => !loading && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 'bold', color: 'warning.main' }}>
          Support JapaApp
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Typography variant="body1" textAlign="center" mb={3}>
            Your contribution helps keep JapaApp running and supports the development of new spiritual features.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
            {predefinedAmounts.map((preset) => (
              <Button
                key={preset}
                variant={amount === preset ? 'contained' : 'outlined'}
                onClick={() => setAmount(preset)}
                sx={{
                  bgcolor: amount === preset ? 'secondary.main' : 'transparent',
                  color: amount === preset ? 'white' : 'secondary.main',
                  borderColor: 'secondary.main',
                  '&:hover': {
                    bgcolor: amount === preset ? 'secondary.dark' : 'rgba(136,19,55,0.04)',
                    borderColor: 'secondary.dark',
                  }
                }}
              >
                ₹{preset}
              </Button>
            ))}
          </Box>

          <TextField
            label="Custom Amount (₹)"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            sx={{ mb: 3 }}
            inputProps={{ min: 1 }}
          />

          <Button
            variant="contained"
            fullWidth
            size="large"
            disabled={loading || !authUser || amount <= 0}
            onClick={handleDonate}
            sx={{ bgcolor: 'warning.main', '&:hover': { bgcolor: 'warning.dark' }, color: 'white' }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : `Donate ₹${amount}`}
          </Button>

          {!authUser && (
            <Typography variant="caption" color="error" display="block" textAlign="center" mt={2}>
              You must be signed in to make a donation.
            </Typography>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
