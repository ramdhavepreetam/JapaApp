import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, Typography, Box, Button, Grid, Paper, Chip, CircularProgress, Alert } from '@mui/material';
import { CheckCircle2 } from 'lucide-react';
import { donationService } from '../services/donationService';
import { useAuth } from '../contexts/AuthContext';

interface SubscribeModalProps {
  open: boolean;
  onClose: () => void;
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['Basic Japa Counter', '1 Active Community', 'Personal Stats', 'Standard Support'],
    color: '#9CA3AF',
    themeColor: 'text.secondary' as const
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 199,
    period: '/mo',
    features: ['Unlimited Communities', 'Advanced Analytics', 'Cloud Sync Backup', 'Priority Support'],
    color: '#881337', // maroon — on-brand
    themeColor: 'secondary.main' as const,
    popular: true
  },
  {
    id: 'community',
    name: 'Community Lead',
    price: 999,
    period: '/mo',
    features: ['Organisation Dashboard', 'Member Data Export', 'Featured Listing', 'Dedicated Manager'],
    color: '#F59E0B', // gold — on-brand
    themeColor: 'warning.main' as const
  }
];

export const SubscribeModal: React.FC<SubscribeModalProps> = ({ open, onClose }) => {
  const { authUser } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (planId: string, price: number) => {
    if (price === 0) {
      onClose();
      return;
    }

    if (!authUser) {
      setError('Please sign in to subscribe.');
      return;
    }

    setLoading(planId);
    setError(null);

    try {
      await donationService.createOrder({
        amount: price * 100,
        isSubscription: true,
        planId,
        onSuccess: () => {
          setLoading(null);
          onClose();
        },
        onError: (err: any) => {
          setLoading(null);
          setError(err.description || 'Subscription failed. Please try again.');
        }
      });
    } catch (err: any) {
      setLoading(null);
      setError(err.message || 'Error initializing subscription.');
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()} maxWidth="md" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pt: 4 }}>
        <Typography variant="h4" fontWeight="bold" color="primary">
          Elevate Your Spiritual Journey
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" mt={1}>
          Choose the plan that suits your practice.
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pb: 4 }}>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Grid container spacing={3} sx={{ mt: 1 }}>
          {plans.map((plan) => {
            const GridItem = Grid as any;
            return (
              <GridItem item xs={12} md={4} key={plan.id}>
                <Paper
                  elevation={plan.popular ? 8 : 2}
                  sx={{
                    p: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    border: plan.popular ? `2px solid ${plan.color}` : 'none',
                    borderRadius: 3
                  }}
                >
                  {plan.popular && (
                    <Chip
                      label="MOST POPULAR"
                      color="secondary"
                      size="small"
                      sx={{ position: 'absolute', top: -12, right: 24, fontWeight: 'bold' }}
                    />
                  )}

                  <Typography variant="h6" fontWeight="bold" sx={{ color: plan.color }}>
                    {plan.name}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'baseline', mt: 2, mb: 3 }}>
                    <Typography variant="h3" fontWeight="bold">
                      ₹{plan.price}
                    </Typography>
                    {plan.period && (
                      <Typography variant="subtitle1" color="text.secondary" ml={1}>
                        {plan.period}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ flexGrow: 1, mb: 3 }}>
                    {plan.features.map((feature, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                        <CheckCircle2 size={20} color={plan.color} style={{ marginRight: 12, flexShrink: 0 }} />
                        <Typography variant="body2">{feature}</Typography>
                      </Box>
                    ))}
                  </Box>

                  <Button
                    variant={plan.popular ? 'contained' : 'outlined'}
                    fullWidth
                    size="large"
                    disabled={!!loading || !authUser}
                    onClick={() => handleSubscribe(plan.id, plan.price)}
                    sx={{
                      bgcolor: plan.popular ? plan.color : undefined,
                      color: plan.popular ? 'white' : plan.color,
                      borderColor: plan.color,
                      '&:hover': {
                        bgcolor: plan.popular ? 'secondary.dark' : 'rgba(136,19,55,0.04)',
                        borderColor: plan.color,
                      }
                    }}
                  >
                    {loading === plan.id ? <CircularProgress size={24} color="inherit" /> : 'Choose Plan'}
                  </Button>
                </Paper>
              </GridItem>
            );
          })}
        </Grid>
      </DialogContent>
    </Dialog>
  );
};
