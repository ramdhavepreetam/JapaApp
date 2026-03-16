import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box, Typography, Avatar, List, ListItem, ListItemAvatar,
    ListItemText, IconButton, Chip, Tabs, Tab,
    Menu, MenuItem
} from '@mui/material';
import { MoreVertical, UserCheck, UserX, Shield, ShieldAlert } from 'lucide-react';
import { CommunityMember, JoinRequest, UserRole } from '../../types/community';
import { communityService } from '../../services/communityService';
import { useAuth } from '../../contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

interface CommunityMembersTabProps {
    communityId: string;
    currentUserRole?: UserRole;
}

export const CommunityMembersTab: React.FC<CommunityMembersTabProps> = ({ communityId, currentUserRole }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [subTab, setSubTab] = useState(0); // 0: Members, 1: Requests
    const [members, setMembers] = useState<CommunityMember[]>([]);
    const [requests, setRequests] = useState<JoinRequest[]>([]);

    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';

    const loadData = async () => {

        try {
            const mems = await communityService.getCommunityMembers(communityId);
            setMembers(mems);
            if (isAdmin) {
                const reqs = await communityService.getJoinRequests(communityId);
                setRequests(reqs);
            }
        } catch (e) {
            console.error("Failed to load members", e);
        } finally {

        }
    };

    useEffect(() => {
        loadData();
    }, [communityId, subTab]);

    const handleApprove = async (req: JoinRequest) => {
        if (!user) return;
        try {
            await communityService.approveMember(communityId, req.user.uid, user.uid);
            loadData();
        } catch (e) { console.error(e); }
    };

    const handleReject = async (req: JoinRequest) => {
        try {
            await communityService.rejectMember(communityId, req.user.uid);
            loadData();
        } catch (e) { console.error(e); }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {isAdmin && (
                <Tabs value={subTab} onChange={(_, v) => setSubTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label={`${t('members.title')} (${members.length})`} />
                    <Tab label={`${t('members.requests')} (${requests.length})`} />
                </Tabs>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto' }}>
                {subTab === 0 ? (
                    <MemberList
                        members={members}
                        currentUserRole={currentUserRole}
                        currentUserId={user?.uid}
                        communityId={communityId}
                        refresh={loadData}
                    />
                ) : (
                    <RequestList
                        requests={requests}
                        onApprove={handleApprove}
                        onReject={handleReject}
                    />
                )}
            </Box>
        </Box>
    );
};

const MemberList: React.FC<{
    members: CommunityMember[],
    currentUserRole?: UserRole,
    currentUserId?: string,
    communityId: string,
    refresh: () => void
}> = ({ members, currentUserRole, currentUserId, communityId, refresh }) => {
    return (
        <List>
            {members.map(member => (
                <MemberItem
                    key={member.uid}
                    member={member}
                    currentUserRole={currentUserRole}
                    currentUserId={currentUserId}
                    communityId={communityId}
                    refresh={refresh}
                />
            ))}
        </List>
    );
};

const MemberItem: React.FC<{
    member: CommunityMember,
    currentUserRole?: UserRole,
    currentUserId?: string,
    communityId: string,
    refresh: () => void
}> = ({ member, currentUserRole, currentUserId, communityId, refresh }) => {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';
    const isTargetOwner = member.role === 'owner';
    const isMe = member.uid === currentUserId;

    // Can operate if:
    // 1. I am admin/owner
    // 2. Target is not me
    // 3. Target is not owner (unless I am owner? No, owner usually transferable only)
    // 4. If I am Admin, I cannot modify other Admins/Owner
    const canOperate = isAdmin && !isMe && !isTargetOwner && (
        currentUserRole === 'owner' || (currentUserRole === 'admin' && member.role === 'member')
    );

    const handleAction = async (action: 'promote' | 'demote' | 'kick' | 'ban') => {
        setAnchorEl(null);
        const confirmMsg = action === 'promote' ? t('members.confirmPromote') : action === 'demote' ? t('members.confirmDemote') : action === 'kick' ? t('members.confirmKick') : t('members.confirmBan');
        if (!confirm(confirmMsg)) return;

        try {
            if (action === 'promote') await communityService.updateMemberRole(communityId, member.uid, 'admin');
            if (action === 'demote') await communityService.updateMemberRole(communityId, member.uid, 'member');
            if (action === 'kick') await communityService.removeOrBanMember(communityId, member.uid, 'remove');
            if (action === 'ban') await communityService.removeOrBanMember(communityId, member.uid, 'ban');
            refresh();
        } catch (e) {
            console.error(e);
            alert(t('members.actionFailed'));
        }
    };

    return (
        <ListItem
            secondaryAction={
                canOperate && (
                    <>
                        <IconButton edge="end" onClick={(e) => setAnchorEl(e.currentTarget)}>
                            <MoreVertical size={20} />
                        </IconButton>
                        <Menu
                            anchorEl={anchorEl}
                            open={Boolean(anchorEl)}
                            onClose={() => setAnchorEl(null)}
                        >
                            {member.role === 'member' && <MenuItem onClick={() => handleAction('promote')}><Shield size={16} style={{ marginRight: 8 }} /> {t('members.promoteToAdmin')}</MenuItem>}
                            {member.role === 'admin' && <MenuItem onClick={() => handleAction('demote')}><ShieldAlert size={16} style={{ marginRight: 8 }} /> {t('members.demoteToMember')}</MenuItem>}
                            <MenuItem onClick={() => handleAction('kick')} sx={{ color: 'error.main' }}><UserX size={16} style={{ marginRight: 8 }} /> {t('members.removeMember')}</MenuItem>
                            <MenuItem onClick={() => handleAction('ban')} sx={{ color: 'error.main' }}>{t('members.banUser')}</MenuItem>
                        </Menu>
                    </>
                )
            }
        >
            <ListItemAvatar>
                <Avatar
                    src={member.photoURL || undefined}
                    sx={{ bgcolor: 'secondary.main' }}
                >
                    {(member.displayName?.[0] || member.uid[0]).toUpperCase()}
                </Avatar>
            </ListItemAvatar>
            <ListItemText
                primary={member.displayName || `Member ${member.uid.slice(0, 6)}`}
                secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip label={member.role} size="small" color={member.role === 'owner' ? "warning" : member.role === 'admin' ? "secondary" : "default"} />
                        <Typography variant="caption">{formatMemberJoinDate(member.joinedAt)}</Typography>
                    </Box>
                }
            />
        </ListItem>
    );
};

// Helper
const formatMemberJoinDate = (ts: any) => {
    if (!ts) return '';
    if (ts.toDate) return format(ts.toDate(), 'MMM d, yyyy');
    return '';
}

const RequestList: React.FC<{ requests: JoinRequest[], onApprove: (r: JoinRequest) => void, onReject: (r: JoinRequest) => void }> = ({ requests, onApprove, onReject }) => {
    const { t } = useTranslation();
    if (requests.length === 0) return <Box p={2}><Typography color="text.secondary">{t('members.noPending')}</Typography></Box>;

    return (
        <List>
            {requests.map(req => (
                <ListItem key={req.id}>
                    <ListItemAvatar>
                        <Avatar src={req.user.photoURL} />
                    </ListItemAvatar>
                    <ListItemText
                        primary={req.user.displayName}
                        secondary={`${t('members.requested')} ${formatDistanceToNow(req.requestedAt.toDate())} ${t('members.ago')}`}
                    />
                    <Box>
                        <IconButton color="success" onClick={() => onApprove(req)}><UserCheck /></IconButton>
                        <IconButton color="error" onClick={() => onReject(req)}><UserX /></IconButton>
                    </Box>
                </ListItem>
            ))}
        </List>
    );
};
