import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, 
  Button, IconButton, Dialog, DialogTitle, DialogContent, 
  DialogActions, TextField, CircularProgress, Alert, Tooltip
} from '@mui/material';
import { Star, Trash } from 'lucide-react';
import { adminService } from '../services/adminService';
import { AdminCommunityView } from '../types/admin';

export const AdminCommunitiesTab: React.FC = () => {
  const [communities, setCommunities] = useState<AdminCommunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<AdminCommunityView | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  const fetchCommunities = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllCommunities();
      setCommunities(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch communities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, []);

  const handleToggleFeature = async (community: AdminCommunityView) => {
    try {
      if (community.featured) {
        await adminService.unfeatureCommunity(community.communityId);
      } else {
        await adminService.featureCommunity(community.communityId);
      }
      // Re-fetch or update state
      setCommunities(prev => {
        const updated = prev.map(c => 
          c.communityId === community.communityId 
            ? { ...c, featured: !c.featured } 
            : c
        );
        // Re-sort: featured first, then by memberCount
        return updated.sort((a, b) => {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.memberCount - a.memberCount;
        });
      });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteClick = (community: AdminCommunityView) => {
    setSelectedCommunity(community);
    setDeleteReason('');
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedCommunity) return;
    try {
      await adminService.deleteCommunity(selectedCommunity.communityId, deleteReason);
      setCommunities(prev => prev.filter(c => c.communityId !== selectedCommunity.communityId));
      setDeleteDialogOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Manage Communities</Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell width={50}></TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Privacy</TableCell>
              <TableCell>Members</TableCell>
              <TableCell>Created By (ID)</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {communities.map((comm) => (
              <TableRow key={comm.communityId}>
                <TableCell>
                  <Tooltip title={comm.featured ? "Unfeature" : "Feature"}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleToggleFeature(comm)}
                      sx={{ color: comm.featured ? '#F59E0B' : 'text.disabled' }}
                    >
                      <Star size={20} fill={comm.featured ? "#F59E0B" : "transparent"} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight={comm.featured ? "bold" : "normal"}>
                    {comm.name}
                  </Typography>
                </TableCell>
                <TableCell>{comm.isPublic ? 'Public' : 'Private'}</TableCell>
                <TableCell>{comm.memberCount}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {comm.createdBy.substring(0, 8)}...
                </TableCell>
                <TableCell>{comm.createdAt?.toDate().toLocaleDateString()}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="error" onClick={() => handleDeleteClick(comm)}>
                    <Trash size={18} />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {communities.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                  No communities found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Community</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. All members will lose access.
          </Alert>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Provide a reason for deleting <strong>{selectedCommunity?.name}</strong> (written to audit log).
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Reason for deletion"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={!deleteReason.trim()}>
            Confirm Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
