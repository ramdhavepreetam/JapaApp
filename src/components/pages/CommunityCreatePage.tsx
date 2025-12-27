import React, { useState } from 'react';
import {
    Box,
    Container,
    Typography,
    TextField,
    Button,
    AppBar,
    Toolbar,
    IconButton,
    Switch,
    FormControlLabel,
    Snackbar,
    Alert
} from '@mui/material';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { communityService } from '../../services/communityService';
import { useAuth } from '../../contexts/AuthContext';
import { UserProfileSummary } from '../../types/community';

interface CommunityCreatePageProps {
    onBack: () => void;
    onCreated: (communityId: string) => void;
}

export const CommunityCreatePage: React.FC<CommunityCreatePageProps> = ({ onBack, onCreated }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        isPrivate: false,
        requiresApproval: false
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.name.trim()) return;

        setLoading(true);
        try {
            const creator: UserProfileSummary = {
                uid: user.uid,
                displayName: user.displayName || 'Sadhaka',
                photoURL: user.photoURL || ''
            };

            const id = await communityService.createCommunity({
                name: formData.name,
                description: formData.description,
                isPrivate: formData.isPrivate,
                requiresApproval: formData.requiresApproval,
                creator,
                tags: [] // Future: Add tag input
            });

            onCreated(id);
        } catch (err: any) {
            setError(err.message || "Failed to create community");
            setLoading(false);
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar>
                    <IconButton edge="start" onClick={onBack} sx={{ mr: 2 }}>
                        <ArrowLeft />
                    </IconButton>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        Create Community
                    </Typography>
                </Toolbar>
            </AppBar>

            <Container maxWidth="sm" sx={{ p: 3, flex: 1, overflowY: 'auto' }}>
                <form onSubmit={handleSubmit}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <TextField
                            label="Community Name"
                            required
                            fullWidth
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            autoFocus
                        />

                        <TextField
                            label="Description"
                            multiline
                            rows={4}
                            fullWidth
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="What is this community about?"
                        />

                        <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 2, border: 1, borderColor: 'divider' }}>
                            <Typography variant="subtitle2" color="primary" gutterBottom>Privacy & Access</Typography>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.isPrivate}
                                        onChange={(e) => setFormData({ ...formData, isPrivate: e.target.checked })}
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body2" fontWeight="bold">Private Community</Typography>
                                        <Typography variant="caption" color="text.secondary">Hidden from discovery, requires invite link</Typography>
                                    </Box>
                                }
                                sx={{ mb: 2, alignItems: 'flex-start', ml: 0 }}
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.requiresApproval}
                                        onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                                    />
                                }
                                label={
                                    <Box>
                                        <Typography variant="body2" fontWeight="bold">Require Approval</Typography>
                                        <Typography variant="caption" color="text.secondary">Admins must approve new members</Typography>
                                    </Box>
                                }
                                sx={{ alignItems: 'flex-start', ml: 0 }}
                            />
                        </Box>

                        <Button
                            type="submit"
                            variant="contained"
                            size="large"
                            fullWidth
                            disabled={loading || !formData.name}
                            sx={{ mt: 2, borderRadius: 8, height: 48 }}
                        >
                            {loading ? <Loader2 className="animate-spin" /> : "Create Community"}
                        </Button>
                    </Box>
                </form>
            </Container>

            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
                <Alert severity="error">{error}</Alert>
            </Snackbar>
        </Box>
    );
};
