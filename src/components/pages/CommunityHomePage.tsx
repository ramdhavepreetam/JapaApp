import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box, AppBar, Toolbar, IconButton, Typography, Tabs, Tab,
    CircularProgress, Button
} from '@mui/material';
import { ArrowLeft, MessageSquare, List as ListIcon, Settings as SettingsIcon, Target, Users } from 'lucide-react';
import { communityService } from '../../services/communityService';
import { Community, UserRole } from '../../types/community';
import { useAuth } from '../../contexts/AuthContext';
import { CommunityCounterTab } from '../tabs/CommunityCounterTab';
import { CommunityFeedTab } from '../tabs/CommunityFeedTab';
import { CommunityChatTab } from '../tabs/CommunityChatTab';
import { CommunityMembersTab } from '../tabs/CommunityMembersTab';
import { CommunitySettingsTab } from '../tabs/CommunitySettingsTab';

interface CommunityHomePageProps {
    communityId: string;
    onBack: () => void;
}

export const CommunityHomePage: React.FC<CommunityHomePageProps> = ({ communityId, onBack }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [community, setCommunity] = useState<Community | null>(null);
    const [myRole, setMyRole] = useState<UserRole | undefined>(undefined);
    const [tab, setTab] = useState(0); // 0: Feed, 1: Chat, 2: Counter, 3: Members, 4: Settings

    // Re-fetch community data (called after japa save to update totals)
    const refreshCommunity = async () => {
        try {
            const c = await communityService.getCommunity(communityId);
            if (c) setCommunity(c);
        } catch (e) {
            console.warn('Failed to refresh community data', e);
        }
    };
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            try {
                const c = await communityService.getCommunity(communityId);
                if (isMounted) setCommunity(c);

                if (user) {
                    const member = await communityService.getCommunityMember(communityId, user.uid);
                    if (member && member.status === 'active' && isMounted) {
                        setMyRole(member.role);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [communityId, user]);

    if (loading || !community) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }
    const isAdmin = myRole === 'admin' || myRole === 'owner';

    const handleJoin = async () => {
        if (!community) return;

        if (!user) {
            alert("Please sign in to join a community.");
            return;
        }

        setLoading(true);
        try {
            if (community.isPrivate || community.requiresApproval) {
                await communityService.requestJoinCommunity(community.id, {
                    uid: user.uid,
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL || ''
                });
                alert("Request sent successfully!");
            } else {
                await communityService.joinCommunityOpen(community.id, {
                    uid: user.uid,
                    displayName: user.displayName || 'User',
                    photoURL: user.photoURL || ''
                });
                const updated = await communityService.getCommunity(community.id);
                if (updated) setCommunity(updated);
                setMyRole('member');
            }
        } catch (e: any) {
            console.error(e);
            alert(e.message || "Failed to join");
        } finally {
            setLoading(false);
        }
    };

    // If not a member, show Preview/Join View
    if (!myRole) {
        return (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
                <AppBar position="sticky" color="default" elevation={0}>
                    <Toolbar>
                        <IconButton edge="start" onClick={onBack} sx={{ mr: 1 }}>
                            <ArrowLeft />
                        </IconButton>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            Join Community
                        </Typography>
                    </Toolbar>
                </AppBar>

                <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <Box
                        sx={{
                            width: 120, height: 120, borderRadius: 4, bgcolor: 'primary.light',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3,
                            color: 'primary.main'
                        }}
                    >
                        {community.imageUrl ? (
                            <img src={community.imageUrl} alt={community.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
                        ) : (
                            <Target size={64} />
                        )}
                    </Box>

                    <Typography variant="h4" fontWeight="bold" gutterBottom>
                        {community.name}
                    </Typography>

                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
                        {community.description || t('communities.noDescription')}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 4, mb: 6 }}>
                        <Box>
                            <Typography variant="h6" fontWeight="bold">{community.membersCount}</Typography>
                            <Typography variant="caption" color="text.secondary">{t('communityTabs.members')}</Typography>
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight="bold">{community.totalMalas}</Typography>
                            <Typography variant="caption" color="text.secondary">Total Malas</Typography>
                        </Box>
                    </Box>

                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        sx={{ borderRadius: 8, height: 56, maxWidth: 300, fontSize: '1.1rem' }}
                        onClick={handleJoin}
                    >
                        {community.requiresApproval || community.isPrivate ? t('communities.requestToJoin') : t('communities.join')}
                    </Button>
                </Box>
            </Box>
        );
    }

    // Existing render for members...
    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <AppBar position="sticky" color="default" elevation={1}>
                <Toolbar>
                    <IconButton edge="start" onClick={onBack} sx={{ mr: 1 }}>
                        <ArrowLeft />
                    </IconButton>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" fontWeight="bold" noWrap>
                            {community.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {community.membersCount} {t('communities.members')}
                        </Typography>
                    </Box>
                </Toolbar>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    indicatorColor="primary"
                    textColor="primary"
                >
                    <Tab icon={<ListIcon size={20} />} label={t('communityTabs.feed')} />
                    <Tab icon={<MessageSquare size={20} />} label={t('communityTabs.chat')} />
                    <Tab icon={<Target size={20} />} label={t('communityTabs.chant')} />
                    <Tab icon={<Users size={20} />} label={t('communityTabs.members')} />
                    {isAdmin && <Tab icon={<SettingsIcon size={20} />} label={t('communityTabs.settings')} />}
                </Tabs>
            </AppBar>

            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {tab === 0 && <CommunityFeedTab communityId={communityId} currentUserRole={myRole} />}
                {tab === 1 && <CommunityChatTab communityId={communityId} currentUserRole={myRole} />}
                {tab === 2 && (
                    <CommunityCounterTab
                        community={community}
                        onViewReport={() => { }}
                        onCommunityUpdated={refreshCommunity}
                    />
                )}
                {tab === 3 && <CommunityMembersTab communityId={communityId} currentUserRole={myRole} />}
                {tab === 4 && isAdmin && <CommunitySettingsTab communityId={communityId} currentUserRole={myRole} />}
            </Box>
        </Box>
    );
};
