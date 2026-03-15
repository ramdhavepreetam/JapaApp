import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Paper, Avatar, 
  Button, Chip, Dialog, DialogTitle, DialogContent, 
  DialogActions, Select, MenuItem, FormControl, InputLabel, CircularProgress, Alert
} from '@mui/material';
import { adminService } from '../services/adminService';
import { AdminUserView } from '../types/admin';
import { UserRole } from '../types/auth';

export const AdminUsersTab: React.FC = () => {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog State
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserView | null>(null);
  const [banReason, setBanReason] = useState('');
  
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('user');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getAllUsers(50);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const filteredUsers = users.filter(u => 
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">Manage Users</Typography>
        <TextField 
          size="small"
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ width: 300 }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>User</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>Joined</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((user) => (
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
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                  No users found matching your search.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Ban Dialog */}
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

      {/* Role Assignment Dialog */}
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
