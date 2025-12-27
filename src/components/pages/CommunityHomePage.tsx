import React, { useEffect, useState } from 'react';
import {
    Box, AppBar, Toolbar, IconButton, Typography, Tabs, Tab,
    CircularProgress
} from '@mui/material';
import { ArrowLeft, MessageSquare, List as ListIcon, Settings as SettingsIcon, Target, Users } from 'lucide-react';
import { communityService } from '../../services/communityService';
import { Community, UserRole, CommunityMember } from '../../types/community';
import { useAuth } from '../../contexts/AuthContext';
import { CommunityCounterTab } from '../tabs/CommunityCounterTab';
import { CommunityFeedTab } from '../tabs/CommunityFeedTab';
import { CommunityChatTab } from '../tabs/CommunityChatTab';
import { CommunityMembersTab } from '../tabs/CommunityMembersTab';
import { CommunitySettingsTab } from '../tabs/CommunitySettingsTab';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface CommunityHomePageProps {
    communityId: string;
    onBack: () => void;
}

export const CommunityHomePage: React.FC<CommunityHomePageProps> = ({ communityId, onBack }) => {
    const { user } = useAuth();
    const [community, setCommunity] = useState<Community | null>(null);
    const [myRole, setMyRole] = useState<UserRole | undefined>(undefined);
    const [tab, setTab] = useState(0); // 0: Feed, 1: Chat, 2: Counter, 3: Members, 4: Settings
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const c = await communityService.getCommunity(communityId);
                setCommunity(c);

                if (user) {
                    // Check membership directly
                    const memRef = doc(db, 'community_members', `${communityId}_${user.uid}`);
                    const memSnap = await getDoc(memRef);
                    if (memSnap.exists()) {
                        const data = memSnap.data() as CommunityMember;
                        if (data.status === 'active') {
                            setMyRole(data.role);
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [communityId, user]);

    if (loading || !community) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress />
            </Box>
        );
    }

    const isAdmin = myRole === 'admin' || myRole === 'owner';

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
                            {community.membersCount} members
                        </Typography>
                    </Box>
                    {/* Settings shorthand or just use tab? Using Tab for cleaner mobile UX usually, or icon. 
                        User prompt said "Settings Tab". I will put it in the Tabs list if Admin. */}
                </Toolbar>
                <Tabs
                    value={tab}
                    onChange={(_, v) => setTab(v)}
                    variant="scrollable"
                    scrollButtons="auto"
                    indicatorColor="primary"
                    textColor="primary"
                >
                    <Tab icon={<ListIcon size={20} />} label="Feed" />
                    <Tab icon={<MessageSquare size={20} />} label="Chat" />
                    <Tab icon={<Target size={20} />} label="Chant" />
                    <Tab icon={<Users size={20} />} label="Members" />
                    {isAdmin && <Tab icon={<SettingsIcon size={20} />} label="Settings" />}
                </Tabs>
            </AppBar>

            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {tab === 0 && <CommunityFeedTab communityId={communityId} currentUserRole={myRole} />}
                {tab === 1 && <CommunityChatTab communityId={communityId} currentUserRole={myRole} />}
                {tab === 2 && (
                    <CommunityCounterTab
                        community={community}
                        onViewReport={() => { }}
                    />
                )}
                {tab === 3 && <CommunityMembersTab communityId={communityId} currentUserRole={myRole} />}
                {tab === 4 && isAdmin && <CommunitySettingsTab communityId={communityId} currentUserRole={myRole} />}
            </Box>
        </Box>
    );
};
