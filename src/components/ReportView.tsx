import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Award, Globe, Heart, Target } from 'lucide-react';
import { storage, StorageSchema } from '../lib/storage';
import { Box, Typography, IconButton, Paper, Container, Grid, Chip } from '@mui/material';
import { useCommunity } from '../contexts/CommunityContext';

interface ReportViewProps {
    onBack: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ onBack }) => {
    const [data, setData] = useState<StorageSchema>(storage.get());
    const { myPledges } = useCommunity();

    useEffect(() => {
        setData(storage.get());
    }, []);

    const historyDates = Object.keys(data.history).sort().reverse();

    // Calculate Community Totals
    const totalCommunityMalas = myPledges.reduce((acc, p) => acc + p.contributedMalas, 0);

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

                <Grid container spacing={2} sx={{ mb: 4 }}>
                    {/* Individual Stats Card */}
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                height: '100%',
                                borderRadius: 4,
                                background: 'linear-gradient(135deg, #EA580C 0%, #C2410C 100%)',
                                color: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                boxShadow: '0 10px 30px -10px rgba(234, 88, 12, 0.5)'
                            }}
                        >
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.9, mb: 1 }}>
                                    <Award size={20} />
                                    <Typography variant="subtitle2" fontWeight={600}>
                                        Individual
                                    </Typography>
                                </Box>
                                <Typography variant="h3" sx={{ fontWeight: 800 }}>
                                    {data.totalCounts.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                    Lifetime Mantras
                                </Typography>
                            </Box>
                            <Chip
                                size="small"
                                label={`Lvl ${Math.floor(data.totalCounts / 1008) + 1}`}
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', alignSelf: 'flex-start', mt: 2 }}
                            />
                        </Paper>
                    </Grid>

                    {/* Community Stats Card */}
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                height: '100%',
                                borderRadius: 4,
                                background: 'linear-gradient(135deg, #0F766E 0%, #0D9488 100%)',
                                color: 'white',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                boxShadow: '0 10px 30px -10px rgba(15, 118, 110, 0.5)'
                            }}
                        >
                            <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0.9, mb: 1 }}>
                                    <Globe size={20} />
                                    <Typography variant="subtitle2" fontWeight={600}>
                                        Community
                                    </Typography>
                                </Box>
                                <Typography variant="h3" sx={{ fontWeight: 800 }}>
                                    {totalCommunityMalas.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                    Malas Contributed
                                </Typography>
                            </Box>
                            <Chip
                                size="small"
                                label={`${myPledges.length} Causes Joined`}
                                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', alignSelf: 'flex-start', mt: 2 }}
                            />
                        </Paper>
                    </Grid>
                </Grid>

                {/* Community Breakdown Section */}
                {myPledges.length > 0 && (
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h6" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Heart size={18} /> Impact Details
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {myPledges.map(pledge => (
                                <Paper key={pledge.id} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                                            {pledge.pledgeTitle}
                                        </Typography>
                                        <Typography variant="caption" fontWeight={600} color="primary">
                                            {pledge.contributedMalas} Malas
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Target size={14} color="#666" />
                                        <Typography variant="caption" color="text.secondary">
                                            Global Target: {pledge.pledgeTarget.toLocaleString()}
                                        </Typography>
                                    </Box>
                                    {/* Optional: Show percentage of YOUR contribution to the goal? Probably too small. */}
                                </Paper>
                            ))}
                        </Box>
                    </Box>
                )}

                <Typography variant="h6" color="text.secondary" gutterBottom sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Calendar size={18} /> Daily History
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
