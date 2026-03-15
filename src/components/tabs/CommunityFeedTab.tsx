import React, { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Card, CardHeader, CardContent,
    CardActions, Avatar, IconButton, Switch, FormControlLabel,
    Menu, MenuItem, Stack, CircularProgress
} from '@mui/material';
import { Heart, MoreVertical, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { communityFeedService } from '../../services/communityFeedService';
import { CommunityPost, UserRole } from '../../types/community';
import { formatDistanceToNow } from 'date-fns';


interface CommunityFeedTabProps {
    communityId: string;
    currentUserRole?: UserRole;
}

export const CommunityFeedTab: React.FC<CommunityFeedTabProps> = ({ communityId, currentUserRole }) => {
    const { user } = useAuth();
    const [posts, setPosts] = useState<CommunityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState('');
    const [isAnnouncement, setIsAnnouncement] = useState(false);
    const [sending, setSending] = useState(false);

    // Refresh feed
    const loadPosts = async () => {
        try {
            const res = await communityFeedService.listPosts(communityId);
            setPosts(res.posts);
        } catch (e) {
            console.error("Failed to load posts", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPosts();
    }, [communityId]);

    const handleCreatePost = async () => {
        if (!content.trim() || !user) return;
        setSending(true);
        try {
            await communityFeedService.createPost(
                communityId,
                isAnnouncement ? 'announcement' : 'text',
                content,
                { uid: user.uid, displayName: user.displayName || 'User', photoURL: user.photoURL || '' }
            );
            setContent('');
            setIsAnnouncement(false);
            loadPosts(); // Refresh list
        } catch (e) {
            console.error("Failed to create post", e);
        } finally {
            setSending(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!user) return;
        try {
            // Optimistic update
            setPosts(prev => prev.filter(p => p.id !== postId));
            await communityFeedService.softDeletePost(communityId, postId, user.uid);
        } catch (e) {
            console.error("Failed to delete post", e);
            loadPosts(); // Revert on failure
        }
    };

    const isAdminOrOwner = currentUserRole === 'admin' || currentUserRole === 'owner';

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f5f5f5' }}>
            {user && (
                <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                        <Avatar src={user?.photoURL || undefined} />
                        <Box sx={{ flex: 1 }}>
                            <TextField
                                fullWidth
                                multiline
                                maxRows={4}
                                placeholder="Share something with the community..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                variant="standard"
                                InputProps={{ disableUnderline: true }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                                {isAdminOrOwner && (
                                    <FormControlLabel
                                        control={<Switch size="small" checked={isAnnouncement} onChange={(e) => setIsAnnouncement(e.target.checked)} />}
                                        label={<Typography variant="caption" fontWeight="bold" color="primary">Announcement</Typography>}
                                    />
                                )}
                                <Box sx={{ ml: 'auto' }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        endIcon={<Send size={16} />}
                                        disabled={!content.trim() || sending}
                                        onClick={handleCreatePost}
                                        sx={{ borderRadius: 4, textTransform: 'none' }}
                                    >
                                        Post
                                    </Button>
                                </Box>
                            </Box>
                        </Box>
                    </Stack>
                </Box>
            )}

            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : posts.length === 0 ? (
                    <Typography align="center" color="text.secondary" sx={{ mt: 4 }}>
                        No posts yet. Be the first to share!
                    </Typography>
                ) : (
                    posts.map(post => (
                        <PostItem
                            key={post.id}
                            post={post}
                            currentUserId={user?.uid}
                            isAdmin={isAdminOrOwner}
                            onDelete={() => handleDeletePost(post.id)}
                            onLikeToggle={() => {/* handled inside */ }}
                        />
                    ))
                )}
            </Box>
        </Box>
    );
};

const PostItem: React.FC<{
    post: CommunityPost;
    currentUserId?: string;
    isAdmin: boolean;
    onDelete: () => void;
    onLikeToggle: () => void;
}> = ({ post, currentUserId, isAdmin, onDelete }) => {
    const [likes, setLikes] = useState(post.likesCount);
    const [liked, setLiked] = useState(false); // In a real app we'd check if user liked it from subcollection or cache
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    // If it's an announcement, styling is different
    const isAnnouncement = post.type === 'announcement';

    const handleLike = async () => {
        if (!currentUserId) return;
        // Optimistic
        const newLiked = !liked;
        setLiked(newLiked);
        setLikes(prev => newLiked ? prev + 1 : prev - 1);

        try {
            await communityFeedService.likePost(post.communityId, post.id, currentUserId);
        } catch (e) {
            // Revert
            setLiked(!newLiked);
            setLikes(prev => newLiked ? prev - 1 : prev + 1);
        }
    };

    const isAuthor = currentUserId === post.author.uid;
    const canDelete = isAuthor || isAdmin;

    return (
        <Card sx={{ mb: 2, borderRadius: 3, boxShadow: 1, border: isAnnouncement ? '1px solid' : 'none', borderColor: 'primary.main' }}>
            {isAnnouncement && (
                <Box sx={{ bgcolor: 'primary.main', color: 'white', px: 2, py: 0.5 }}>
                    <Typography variant="caption" fontWeight="bold">ANNOUNCEMENT</Typography>
                </Box>
            )}
            <CardHeader
                avatar={<Avatar src={post.author.photoURL}>{post.author.displayName[0]}</Avatar>}
                action={
                    canDelete && (
                        <>
                            <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                                <MoreVertical size={18} />
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={() => setAnchorEl(null)}
                            >
                                <MenuItem onClick={() => { onDelete(); setAnchorEl(null); }} sx={{ color: 'error.main' }}>
                                    <Trash2 size={16} style={{ marginRight: 8 }} /> Delete
                                </MenuItem>
                            </Menu>
                        </>
                    )
                }
                title={post.author.displayName}
                subheader={formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true })}
            />
            <CardContent sx={{ py: 1 }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                    {post.content}
                </Typography>
            </CardContent>
            <CardActions disableSpacing>
                <Button
                    size="small"
                    startIcon={<Heart size={18} fill={liked ? "currentColor" : "none"} />}
                    color={liked ? "error" : "inherit"}
                    onClick={handleLike}
                >
                    {likes}
                </Button>
                {/* Comments future scope */}
                {/* <Button size="small" startIcon={<MessageCircle size={18} />} color="inherit">
                    {post.commentCount}
                </Button> */}
            </CardActions>
        </Card>
    );
};
