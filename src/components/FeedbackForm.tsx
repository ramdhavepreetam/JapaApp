import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box, Button, Dialog, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, TextField,
  Typography, IconButton, CircularProgress
} from '@mui/material';
import { X, MessageSquare } from 'lucide-react';
import { feedbackService, FeedbackCategory } from '../services/feedbackService';
import { useAuth } from '../contexts/AuthContext';

interface FeedbackFormProps {
  open: boolean;
  onClose: () => void;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory>('general');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!message.trim() || !user) return;
    setLoading(true);
    setError('');
    try {
      await feedbackService.submit(category, message);
      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch {
      setError(t('feedback.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMessage('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3, m: 2 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <MessageSquare size={20} />
        <Typography variant="h6" sx={{ flex: 1 }}>{t('feedback.title')}</Typography>
        <IconButton size="small" onClick={handleClose} disabled={loading}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="h4">🙏</Typography>
            <Typography variant="body1" sx={{ mt: 1 }}>{t('feedback.success')}</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('feedback.subtitle')}
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>{t('feedback.category')}</InputLabel>
              <Select
                value={category}
                label={t('feedback.category')}
                onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              >
                <MenuItem value="bug">{t('feedback.categoryBug')}</MenuItem>
                <MenuItem value="feature">{t('feedback.categoryFeature')}</MenuItem>
                <MenuItem value="general">{t('feedback.categoryGeneral')}</MenuItem>
              </Select>
            </FormControl>
            <TextField
              multiline
              rows={4}
              fullWidth
              label={t('feedback.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
              disabled={loading}
              helperText={`${message.length}/1000`}
            />
            {error && (
              <Typography variant="caption" color="error">{error}</Typography>
            )}
            <Button
              variant="contained"
              fullWidth
              onClick={handleSubmit}
              disabled={loading || !message.trim()}
              sx={{ borderRadius: 3, textTransform: 'none' }}
            >
              {loading ? <CircularProgress size={20} color="inherit" /> : t('feedback.submit')}
            </Button>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
};
