import React, { useEffect, useState } from 'react';
import { Box, Typography, List, ListItemText, ListItemAvatar, Avatar, IconButton, AppBar, Toolbar, CircularProgress, ListItemButton } from '@mui/material';
import { ArrowLeft, Bell, MessageCircle, UserPlus, Info } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notificationService';
import { Notification } from '../../types/community';

import { communityService } from '../../services/communityService';

interface NotificationsPageProps {
    onBack: () => void;
    onNavigate: (view: any, params?: any) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onBack }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            try {
                const myComms = await communityService.getMyCommunities(user.uid);
                const commIds = myComms.map(c => c.communityId);
                const items = await notificationService.listAnnouncements(commIds);
                setNotifications(items);
            } catch (e) {
                console.error("Failed to load announcements", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user]);

    const handleClick = async (notification: Notification) => {
        if (!user) return;
        if (!notification.read) {
            // Optimistic update
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
            // For announcement, we mark the whole community as read
            if (notification.type === 'announcement' && notification.data?.communityId) {
                await notificationService.markAnnouncementsRead(notification.data.communityId, user.uid);
            } else {
                // Fallback for old notifications if any
                await notificationService.markRead(user.uid, notification.id);
            }
        }
        // Handle navigation based on type later if needed
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'join_request': return <UserPlus size={20} />;
            case 'reply': return <MessageCircle size={20} />;
            case 'announcement': return <Info size={20} />;
            default: return <Bell size={20} />;
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar>
                    <IconButton edge="start" onClick={onBack} sx={{ mr: 2 }}>
                        <ArrowLeft />
                    </IconButton>
                    <Typography variant="h6">Notifications</Typography>
                </Toolbar>
            </AppBar>

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : notifications.length === 0 ? (
                    <Box sx={{ textAlign: 'center', p: 4, opacity: 0.6 }}>
                        <Typography>No notifications yet.</Typography>
                    </Box>
                ) : (
                    <List>
                        {notifications.map((n) => (
                            <ListItemButton
                                key={n.id}
                                onClick={() => handleClick(n)}
                                sx={{
                                    bgcolor: n.read ? 'transparent' : 'action.hover',
                                    borderBottom: '1px solid',
                                    borderColor: 'divider'
                                }}
                            >
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: n.read ? 'grey.300' : 'primary.light', color: n.read ? 'grey.600' : 'primary.main' }}>
                                        {getIcon(n.type)}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={n.title}
                                    secondary={n.body}
                                    primaryTypographyProps={{ fontWeight: n.read ? 'normal' : 'bold' }}
                                />
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </Box>
        </Box>
    );
};
