import React, { useEffect, useState } from 'react';
import {
    Box, Typography, Button, TextField, Select, MenuItem,
    FormControl, InputLabel, Table, TableBody, TableCell,
    TableHead, TableRow, Paper, IconButton, CircularProgress,
    Alert, Collapse
} from '@mui/material';
import { Trash2, Plus, X, Music2 } from 'lucide-react';
import { Mantra } from '../types/mantra';
import { mantraService } from '../services/mantraService';
import { useAuth } from '../contexts/AuthContext';

const TRADITIONS = ['Shaiva', 'Vaishnava', 'Vedic', 'Buddhist', 'Jain', 'Other'];

const emptyForm = { name: '', nameDevanagari: '', nameMarathi: '', tradition: 'Shaiva', audioUrl: '', position: 1 };

export const AdminMantrasTab: React.FC = () => {
    const { user } = useAuth();
    const [mantras, setMantras] = useState<Mantra[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const list = await mantraService.getMantras();
            setMantras(list);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleAdd = async () => {
        if (!form.name.trim() || !form.audioUrl.trim()) {
            setError('Name and Audio URL are required.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await mantraService.addMantra({ ...form, position: Number(form.position) }, user!.uid);
            setSuccess('Mantra added successfully.');
            setForm(emptyForm);
            setShowForm(false);
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to add mantra.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        try {
            await mantraService.deleteMantra(id);
            setSuccess('Mantra deleted.');
            await load();
        } catch (e: any) {
            setError(e.message || 'Failed to delete.');
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Music2 size={20} color="#EA580C" />
                    <Typography variant="h6" fontWeight="bold">Mantra Library</Typography>
                    <Typography variant="body2" color="text.secondary">({mantras.length} mantras)</Typography>
                </Box>
                <Button
                    variant={showForm ? 'outlined' : 'contained'}
                    startIcon={showForm ? <X size={16} /> : <Plus size={16} />}
                    onClick={() => { setShowForm(p => !p); setError(null); }}
                    color="primary"
                    size="small"
                >
                    {showForm ? 'Cancel' : 'Add Mantra'}
                </Button>
            </Box>

            {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>}
            {success && <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>}

            {/* Add form */}
            <Collapse in={showForm}>
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: 'primary.light' }}>
                    <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>New Mantra</Typography>
                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                        <TextField
                            label="Name (English)" size="small" fullWidth required
                            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Om Namah Shivaya"
                        />
                        <TextField
                            label="Devanagari Script (Hindi/Sanskrit)" size="small" fullWidth
                            value={form.nameDevanagari} onChange={e => setForm(p => ({ ...p, nameDevanagari: e.target.value }))}
                            placeholder="ॐ नमः शिवाय"
                            inputProps={{ style: { fontFamily: '"Noto Sans Devanagari", sans-serif' } }}
                        />
                        <TextField
                            label="Marathi Script (optional)" size="small" fullWidth
                            value={form.nameMarathi} onChange={e => setForm(p => ({ ...p, nameMarathi: e.target.value }))}
                            placeholder="णमो अरिहंताणं"
                            inputProps={{ style: { fontFamily: '"Noto Sans Devanagari", sans-serif' } }}
                            helperText="Marathi / Prakrit text in Devanagari — shown below Devanagari in the player"
                        />
                        <Box sx={{ display: 'flex', gap: 1.5 }}>
                            <FormControl size="small" sx={{ minWidth: 140 }}>
                                <InputLabel>Tradition</InputLabel>
                                <Select label="Tradition" value={form.tradition} onChange={e => setForm(p => ({ ...p, tradition: e.target.value }))}>
                                    {TRADITIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <TextField
                                label="Position (order)" size="small" type="number"
                                value={form.position} onChange={e => setForm(p => ({ ...p, position: Number(e.target.value) }))}
                                sx={{ width: 120 }}
                            />
                        </Box>
                        <TextField
                            label="Cloudflare R2 Audio URL" size="small" fullWidth required
                            value={form.audioUrl} onChange={e => setForm(p => ({ ...p, audioUrl: e.target.value }))}
                            placeholder="https://your-r2-domain.com/mantras/om-namah-shivaya.mp3"
                            helperText="Upload .mp3/.ogg to R2, ensure CORS is enabled, paste the public URL here."
                        />
                        <Button
                            variant="contained" onClick={handleAdd} disabled={saving}
                            startIcon={saving ? <CircularProgress size={14} /> : <Plus size={16} />}
                        >
                            {saving ? 'Adding...' : 'Add Mantra'}
                        </Button>
                    </Box>
                </Paper>
            </Collapse>

            {/* Table */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress color="primary" />
                </Box>
            ) : mantras.length === 0 ? (
                <Alert severity="info">No mantras yet. Add the first one above.</Alert>
            ) : (
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#FFF8F0' }}>
                                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Devanagari</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Marathi</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Tradition</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>Audio</TableCell>
                                <TableCell />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {mantras.map(m => (
                                <TableRow key={m.id} hover>
                                    <TableCell>{m.position}</TableCell>
                                    <TableCell sx={{ fontFamily: '"Playfair Display", serif', fontWeight: 600 }}>{m.name}</TableCell>
                                    <TableCell sx={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: 13 }}>{m.nameDevanagari}</TableCell>
                                    <TableCell sx={{ fontFamily: '"Noto Sans Devanagari", sans-serif', fontSize: 13, color: 'text.secondary' }}>{m.nameMarathi || '—'}</TableCell>
                                    <TableCell>
                                        <Box component="span" sx={{
                                            fontSize: 11, px: 1, py: 0.3, borderRadius: 1,
                                            bgcolor: 'rgba(234,88,12,0.1)', color: 'primary.dark', fontWeight: 600
                                        }}>
                                            {m.tradition}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        {m.audioUrl
                                            ? <Box component="span" sx={{ fontSize: 11, color: 'success.dark' }}>✓ set</Box>
                                            : <Box component="span" sx={{ fontSize: 11, color: 'error.main' }}>✗ missing</Box>
                                        }
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" color="error" onClick={() => handleDelete(m.id, m.name)}>
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Paper>
            )}
        </Box>
    );
};
