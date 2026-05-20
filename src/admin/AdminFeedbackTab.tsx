import React, { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, Chip, Paper, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Alert, Divider, Button
} from '@mui/material';
import { feedbackService, AppFeedback, FeedbackStatus, FeedbackPage } from '../services/feedbackService';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

const PAGE_SIZE = 20;

const CATEGORY_LABEL: Record<string, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  general: 'General'
};

const STATUS_COLOR: Record<FeedbackStatus, 'default' | 'warning' | 'success'> = {
  new: 'default',
  reviewed: 'warning',
  resolved: 'success'
};

export const AdminFeedbackTab: React.FC = () => {
  const [items, setItems] = useState<AppFeedback[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const loadPage = useCallback(async (after?: QueryDocumentSnapshot<DocumentData>) => {
    try {
      const page: FeedbackPage = await feedbackService.getActiveFeedback(PAGE_SIZE, after);
      setItems(prev => after ? [...prev, ...page.items] : page.items);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (err: any) {
      // Index still building — fall back to full fetch with client-side filter
      if (!after && err?.code === 'failed-precondition') {
        try {
          const all = await feedbackService.getFeedback(100);
          setItems(all.filter(f => f.status !== 'resolved'));
          setCursor(null);
          setHasMore(false);
        } catch {
          setError('Failed to load feedback');
        }
      } else {
        setError('Failed to load feedback');
      }
    }
  }, []);

  useEffect(() => {
    loadPage().finally(() => setLoading(false));
  }, [loadPage]);

  const handleLoadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await loadPage(cursor);
    setLoadingMore(false);
  };

  const handleStatusChange = async (id: string, status: FeedbackStatus) => {
    try {
      await feedbackService.updateStatus(id, status);
      if (status === 'resolved') {
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
      }
    } catch {
      // silent — non-critical
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (items.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', opacity: 0.6 }}>
        <Typography variant="body1">No open feedback.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {items.length} open submission{items.length !== 1 ? 's' : ''}
      </Typography>
      {items.map(item => (
        <Paper key={item.id} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Chip label={CATEGORY_LABEL[item.category] || item.category} size="small" />
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {item.displayName}{item.email ? ` (${item.email})` : ''} · {item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleString()
                : ''}
            </Typography>
            <Chip
              label={item.status || 'new'}
              size="small"
              color={STATUS_COLOR[item.status] || 'default'}
            />
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={item.status || 'new'}
                label="Status"
                onChange={(e) => handleStatusChange(item.id!, e.target.value as FeedbackStatus)}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="reviewed">Reviewed</MenuItem>
                <MenuItem value="resolved">Resolved</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{item.message}</Typography>
        </Paper>
      ))}
      {hasMore && (
        <Button
          variant="outlined"
          onClick={handleLoadMore}
          disabled={loadingMore}
          sx={{ alignSelf: 'center', borderRadius: 3, textTransform: 'none' }}
        >
          {loadingMore ? <CircularProgress size={18} /> : 'Load more'}
        </Button>
      )}
    </Box>
  );
};
