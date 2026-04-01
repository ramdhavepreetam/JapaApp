import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Avatar,
  Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, Select, MenuItem, FormControl, InputLabel,
  CircularProgress, Alert
} from '@mui/material';
import { DocumentSnapshot } from 'firebase/firestore';
import { adminService } from '../services/adminService';
import { AdminUserView } from '../types/admin';
import { UserRole } from '../types/auth';
import { formatRelativeTime } from '../utils/formatRelativeTime';

export const AdminUsersTab: React.FC = () => {
  const PAGE_SIZE = 50;

  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [totalUsers, setTotalUsers] = useState<number | null>(null);

  // Pagination cursor stack
  const [cursorStack, setCursorStack] = useState<DocumentSnapshot[]>([]);
  const [currentCursor, setCurrentCursor] = useState<DocumentSnapshot | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [isLastPage, setIsLastPage] = useState(false);

  // Search debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSearchMode, setIsSearchMode] = useState(false);

  // Dialog State
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserView | null>(null);
  const [banReason, setBanReason] = useState('');

  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');

  const fetchUsers = async (cursor?: DocumentSnapshot) => {
    try {
      setLoading(true);
      setError(null);
      const { users: data, lastDoc } = await adminService.getAllUsers(PAGE_SIZE, cursor);
      setUsers(data);
      // Store lastDoc so handleNextPage knows where page 1 ends
      setCurrentCursor(lastDoc ?? undefined);
      setIsLastPage(data.length < PAGE_SIZE || lastDoc === null);
      // After first page load, also fetch total user count for summary bar
      if (!cursor) {
        adminService.getAppStats().then(stats => setTotalUsers(stats.totalUsers)).catch(() => {});
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      // Returning to paginated mode — reset
      setIsSearchMode(false);
      setCursorStack([]);
      setCurrentCursor(undefined);
      setPage(1);
      setIsLastPage(false);
      fetchUsers(undefined);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setIsSearchMode(true);
        setIsLastPage(false);
        const results = await adminService.searchUsers(value.trim());
        setUsers(results);
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleNextPage = async () => {
    if (isLastPage) return;
    try {
      setLoading(true);
      const { users: data, lastDoc } = await adminService.getAllUsers(PAGE_SIZE, currentCursor);
      if (data.length === 0) {
        setIsLastPage(true);
        setLoading(false);
        return; // don't advance page counter; table shows "No more users."
      }
      // Push current cursor onto stack before advancing
      setCursorStack(prev => currentCursor ? [...prev, currentCursor] : prev);
      setCurrentCursor(lastDoc ?? undefined);
      setUsers(data);
      setIsLastPage(data.length < PAGE_SIZE);
      setPage(prev => prev + 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load next page');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevPage = async () => {
    if (page <= 1) return;
    try {
      setLoading(true);
      const newStack = [...cursorStack];
      newStack.pop(); // remove the cursor we used to reach the current page
      // After pop, use the new top of the stack (not the popped value) as the cursor
      const prevCursor = newStack.length > 0 ? newStack[newStack.length - 1] : undefined;
      const { users: data, lastDoc } = await adminService.getAllUsers(PAGE_SIZE, prevCursor);
      setCursorStack(newStack);
      setCurrentCursor(lastDoc ?? undefined);
      setUsers(data);
      setIsLastPage(data.length < PAGE_SIZE);
      setPage(prev => prev - 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load previous page');
    } finally {
      setLoading(false);
    }
  };

  const handleBanClick = (user: AdminUserView) => {
    setSelectedUser(user);
    setBanReason('');
    setBanDialogOpen(true);
  };

  const handleConfirmBan = async () => {
    if (!selectedUser) return;
    try {
      await adminService.banUser(selectedUser.uid, banReason);
      setUsers(users.map(u => u.uid === selectedUser.uid ? { ...u, status: 'banned' } : u));
      setBanDialogOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnbanClick = async (user: AdminUserView) => {
    if (window.confirm(`Are you sure you want to unban ${user.displayName}?`)) {
      try {
        await adminService.unbanUser(user.uid);
        setUsers(users.map(u => u.uid === user.uid ? { ...u, status: 'active' } : u));
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleRoleClick = (user: AdminUserView) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleDialogOpen(true);
  };

  const handleConfirmRole = async () => {
    if (!selectedUser) return;
    try {
      await adminService.assignRole(selectedUser.uid, selectedRole);
      setUsers(users.map(u => u.uid === selectedUser.uid ? { ...u, role: selectedRole } : u));
      setRoleDialogOpen(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Summary bar computed values
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const activeCount = users.filter(u => {
    if (!u.stats.lastChantDate) return false;
    return new Date(u.stats.lastChantDate + 'T00:00:00') >= sevenDaysAgo;
  }).length;

  const loggedInCount = users.filter(u => {
    if (!u.lastLoginAt) return false;
    return u.lastLoginAt.toDate() >= sevenDaysAgo;
  }).length;

  // Full-page fallback only for initial load failures
  if (loading && users.length === 0) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error && users.length === 0) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      {/* Summary bar */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Chip label={`Total Users: ${totalUsers ?? '…'}`} variant="outlined" />
        <Chip label={`Active 7d (newest 50): ${activeCount}`} color="success" variant="outlined" />
        <Chip label={`Logged in 7d (newest 50): ${loggedInCount}`} color="primary" variant="outlined" />
      </Box>

      {error && users.length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search + heading */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6">Manage Users</Typography>
        <TextField
          size="small"
          placeholder="Search by name or email (prefix)…"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          sx={{ width: 300 }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 700 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell>Last Login</TableCell>
              <TableCell>Last Active</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!loading && users.map((user) => (
              <TableRow key={user.uid}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ width: 32, height: 32, mr: 2 }}>{user.displayName.charAt(0)}</Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{user.displayName}</Typography>
                      <Typography variant="caption" color="text.secondary">{user.email}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={user.role} color={user.role === 'superadmin' ? 'secondary' : 'default'} />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={user.status}
                    color={user.status === 'banned' ? 'error' : 'success'}
                  />
                </TableCell>
                <TableCell>{user.plan}</TableCell>
                <TableCell>{user.joinedAt?.toDate().toLocaleDateString()}</TableCell>
                <TableCell>
                  <Typography variant="body2" color={user.lastLoginAt ? 'text.primary' : 'text.disabled'}>
                    {formatRelativeTime(user.lastLoginAt)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color={user.stats.lastChantDate ? 'text.primary' : 'text.disabled'}>
                    {formatRelativeTime(user.stats.lastChantDate)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => handleRoleClick(user)}>Role</Button>
                  {user.status === 'banned' ? (
                    <Button size="small" color="success" onClick={() => handleUnbanClick(user)}>Unban</Button>
                  ) : (
                    <Button size="small" color="error" onClick={() => handleBanClick(user)}>Ban</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  {isSearchMode ? 'No users found matching your search.' : 'No more users.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination bar — hidden in search mode */}
      {!isSearchMode && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 2, gap: 2 }}>
          <Button size="small" variant="outlined" onClick={handlePrevPage} disabled={page <= 1}>
            Prev
          </Button>
          <Typography variant="body2">Page {page}</Typography>
          <Button size="small" variant="outlined" onClick={handleNextPage} disabled={isLastPage}>
            Next
          </Button>
        </Box>
      )}

      {/* Ban Dialog — unchanged */}
      <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)}>
        <DialogTitle>Ban User</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Are you sure you want to ban {selectedUser?.displayName}? They will not be able to access the app.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Reason for banning"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBanDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmBan} color="error" variant="contained" disabled={!banReason.trim()}>
            Confirm Ban
          </Button>
        </DialogActions>
      </Dialog>

      {/* Role Assignment Dialog — unchanged */}
      <Dialog open={roleDialogOpen} onClose={() => setRoleDialogOpen(false)}>
        <DialogTitle>Assign Role</DialogTitle>
        <DialogContent sx={{ minWidth: 300 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Change role for {selectedUser?.displayName}.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select
              value={selectedRole}
              label="Role"
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="community_admin">Community Admin</MenuItem>
              <MenuItem value="superadmin">Superadmin</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleConfirmRole} color="primary" variant="contained">
            Save Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
