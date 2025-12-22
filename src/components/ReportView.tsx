import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Award } from 'lucide-react';
import { storage, StorageSchema } from '../lib/storage';
import { Box, Typography, IconButton, Paper, Container } from '@mui/material';

interface ReportViewProps {
    onBack: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ onBack }) => {
    const [data, setData] = useState<StorageSchema>(storage.get());

    useEffect(() => {
        setData(storage.get());
    }, []);

    const historyDates = Object.keys(data.history).sort().reverse();

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={onBack} color="primary">
                    <ArrowLeft size={24} />
                </IconButton>
                <Typography variant="h5" component="h2" color="primary.dark">
                    Your Journey
                </Typography>
            </Box>

            <Container maxWidth="sm" sx={{ flex: 1, overflowY: 'auto', px: 3, pb: 4 }}>
                {/* Total Stats Card */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 4,
                        mb: 4,
                        borderRadius: 4,
                        background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
                        color: 'white',
                        textAlign: 'center',
                        boxShadow: '0 10px 30px -10px rgba(234, 88, 12, 0.5)'
                    }}
                >
                    <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 2 }}>
                        Total Lifetime Mantras
                    </Typography>
                    <Typography variant="h2" sx={{ fontWeight: 800, my: 1 }}>
                        {data.totalCounts.toLocaleString()}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, opacity: 0.9, mt: 2 }}>
                        <Award size={18} />
                        <Typography variant="subtitle2">
                            Devotion Level: {Math.floor(data.totalCounts / 1008) + 1}
                        </Typography>
                    </Box>
                </Paper>

                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mt: 4, mb: 2 }}>
                    Daily History
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {historyDates.length === 0 ? (
                        <Typography color="text.disabled" sx={{ fontStyle: 'italic', textAlign: 'center', py: 4 }}>
                            No chanting history yet. Start today!
                        </Typography>
                    ) : (
                        historyDates.map(date => {
                            const day = data.history[date];
                            return (
                                <Paper
                                    key={date}
                                    elevation={0}
                                    sx={{
                                        p: 2.5,
                                        borderRadius: 3,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2
                                    }}
                                >
                                    <Box sx={{
                                        bgcolor: 'primary.light',
                                        color: 'white',
                                        p: 1.5,
                                        borderRadius: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Calendar size={20} />
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {day.malas} Malas Completed
                                        </Typography>
                                    </Box>
                                    <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
                                        {day.counts}
                                    </Typography>
                                </Paper>
                            );
                        })
                    )}
                </Box>
            </Container>
        </Box>
    );
};
