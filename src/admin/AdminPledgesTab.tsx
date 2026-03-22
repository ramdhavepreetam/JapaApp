import React, { useEffect, useState } from 'react';
import {
    Box, Typography, TextField, Table, TableBody, TableCell, TableHead,
    TableRow, Paper, LinearProgress, Chip, IconButton, Tooltip,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
    Button, CircularProgress, Alert
} from '@mui/material';
import { Trash2, Search, Globe, Users } from 'lucide-react';
import { adminService } from '../services/adminService';
import { Pledge } from '../types/pledge';
import { useAuth } from '../contexts/AuthContext';

export const AdminPledgesTab: React.FC = () => {
    useAuth();
    const [pledges, setPledges] = useState<Pledge[]>([]);
    const [filtered, setFiltered] = useState<Pledge[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<Pledge | null>(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await adminService.getPledges();
            setPledges(data);
            setFiltered(data);
        } catch (e: any) {
            setError(e.message || 'Failed to load pledges');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    useEffect(() => {
        const lower = searchTerm.toLowerCase();
        setFiltered(
            pledges.filter(p =>
                p.title.toLowerCase().includes(lower) ||
                (p.communityId || '').toLowerCase().includes(lower) ||
                (p.creatorId || '').toLowerCase().includes(lower)
            )
        );
    }, [searchTerm, pledges]);

    const handleDelete = async () => {
        if (!deleteTarget || !deleteReason.trim()) return;
        setDeleting(true);
        try {
            await adminService.deletePledge(deleteTarget.id, deleteReason.trim());
            setPledges(prev => prev.filter(p => p.id !== deleteTarget.id));
            setDeleteTarget(null);
            setDeleteReason('');
        } catch (e: any) {
            setError(e.message || 'Failed to delete pledge');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight="bold">Pledge Management</Typography>
                <Typography variant="caption" color="text.secondary">{filtered.length} pledges</Typography>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            <TextField
                fullWidth
                size="small"
                placeholder="Search by title, community ID, or creator..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                InputProps={{ startAdornment: <Search size={16} style={{ marginRight: 8, color: '#999' }} /> }}
                sx={{ mb: 2 }}
            />

            <Paper elevation={0} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell><b>Title</b></TableCell>
                            <TableCell><b>Scope</b></TableCell>
                            <TableCell><b>Progress</b></TableCell>
                            <TableCell align="center"><b>Participants</b></TableCell>
                            <TableCell align="right"><b>Action</b></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    No pledges found.
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map(pledge => {
                            const pct = pledge.targetMalas > 0
                                ? Math.min(100, Math.round((pledge.currentMalas / pledge.targetMalas) * 100))
                                : 0;
                            return (
                                <TableRow key={pledge.id} hover>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                                            {pledge.title}
                                        </Typography>
                                        {pledge.mantra && (
                                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', maxWidth: 200 }}>
                                                "{pledge.mantra}"
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {pledge.communityId ? (
                                            <Chip
                                                icon={<Users size={12} />}
                                                label="Community"
                                                size="small"
                                                color="primary"
                                                variant="outlined"
                                            />
                                        ) : (
                                            <Chip
                                                icon={<Globe size={12} />}
                                                label="Global"
                                                size="small"
                                                variant="outlined"
                                            />
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ minWidth: 160 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <LinearProgress
                                                variant="determinate"
                                                value={pct}
                                                sx={{ flex: 1, height: 6, borderRadius: 3 }}
                                            />
                                            <Typography variant="caption" sx={{ minWidth: 32 }}>{pct}%</Typography>
                                        </Box>
                                        <Typography variant="caption" color="text.secondary">
                                            {pledge.currentMalas.toLocaleString()} / {pledge.targetMalas.toLocaleString()}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2">{pledge.participants}</Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Delete pledge (irreversible)">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => setDeleteTarget(pledge)}
                                            >
                                                <Trash2 size={16} />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </Paper>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeleteReason(''); }} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ color: 'error.main' }}>Delete Pledge</DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ mb: 2 }}>
                        You are about to permanently delete <b>"{deleteTarget?.title}"</b> and all {deleteTarget?.participants} participant records.
                        This action cannot be undone and will be recorded in the audit log.
                    </DialogContentText>
                    <TextField
                        fullWidth
                        label="Reason for deletion (required)"
                        value={deleteReason}
                        onChange={e => setDeleteReason(e.target.value)}
                        multiline
                        rows={2}
                        placeholder="e.g. Spam, inappropriate content, community request..."
                        autoFocus
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDelete}
                        disabled={!deleteReason.trim() || deleting}
                        startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
                    >
                        {deleting ? 'Deleting...' : 'Delete Pledge'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
