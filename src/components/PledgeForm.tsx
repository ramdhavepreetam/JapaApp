import React, { useState, useEffect } from 'react';
import { Pledge } from '../types/pledge';
import { DialogTitle, DialogContent, DialogActions, TextField, Button, Box } from '@mui/material';

interface PledgeFormProps {
    onClose: () => void;
    onSubmit: (data: Omit<Pledge, 'id' | 'currentMalas' | 'participants'>) => void;
    loading?: boolean;
    serverError?: string | null;
    initialData?: Pledge;
    isEditing?: boolean;
}

export const PledgeForm: React.FC<PledgeFormProps> = ({ onClose, onSubmit, loading, serverError, initialData, isEditing = false }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [targetMalas, setTargetMalas] = useState('1008');
    const [mantra, setMantra] = useState('');

    useEffect(() => {
        if (initialData) {
            setTitle(initialData.title);
            setDescription(initialData.description);
            setTargetMalas(initialData.targetMalas.toString());
            setMantra(initialData.mantra || '');
        }
    }, [initialData]);

    // Internal validation error
    const [validationError, setValidationError] = useState<string | null>(null);

    // Merge errors for display
    const displayError = validationError || serverError;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        if (!title.trim() || !description.trim()) {
            setValidationError("Please fill in all required fields.");
            return;
        }

        const target = parseInt(targetMalas);
        if (isNaN(target) || target <= 0) {
            setValidationError("Please enter a valid target number.");
            return;
        }

        onSubmit({
            title: title.trim(),
            description: description.trim(),
            targetMalas: target,
            mantra: mantra.trim()
        });
    };

    return (
        <form onSubmit={handleSubmit}>
            <DialogTitle sx={{ fontFamily: '"Playfair Display", serif' }}>
                {isEditing ? "Edit Cause" : "New Spiritual Cause"}
            </DialogTitle>
            <DialogContent dividers>
                {displayError && (
                    <Box sx={{ p: 1, mb: 2, bgcolor: 'error.lighter', color: 'error.main', borderRadius: 1, border: '1px solid', borderColor: 'error.light' }}>
                        {displayError}
                    </Box>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
                    <TextField
                        label="Cause Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        required
                        fullWidth
                        placeholder="e.g. World Peace Chant"
                        variant="outlined"
                    />

                    <TextField
                        label="Description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        required
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="What is the intention behind this pledge?"
                        variant="outlined"
                    />

                    <TextField
                        label="Target Malas"
                        type="number"
                        value={targetMalas}
                        onChange={e => setTargetMalas(e.target.value)}
                        required
                        fullWidth
                        helperText="Total malas the community should aim to chant together."
                        variant="outlined"
                    />

                    <TextField
                        label="Associated Mantra (Optional)"
                        value={mantra}
                        onChange={e => setMantra(e.target.value)}
                        fullWidth
                        placeholder="e.g. Om Namah Shivaya"
                        variant="outlined"
                        helperText="The specific mantra for this cause."
                    />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
                <Button onClick={onClose} color="inherit" disabled={loading}>
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    color="primary"
                    disabled={!title || !description || loading}
                >
                    {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Cause")}
                </Button>
            </DialogActions>
        </form>
    );
};
