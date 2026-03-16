import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Box, TextField, IconButton, Typography,
    Paper, Button
} from '@mui/material';
import { Send, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { communityChatService } from '../../services/communityChatService';
import { ChatMessage, UserRole } from '../../types/community';
import { format } from 'date-fns';

interface CommunityChatTabProps {
    communityId: string;
    currentUserRole?: UserRole;
}

export const CommunityChatTab: React.FC<CommunityChatTabProps> = ({ communityId, currentUserRole }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Initial Subscribe (Last 50)
    useEffect(() => {
        // Assume messages are returned newest first (desc), so we reverse for display
        const unsub = communityChatService.subscribeToChat(communityId, 50, (newMessages) => {
            // newMessages typically come in desc order (newest at index 0) from the service queries
            // We want to display oldest at top.
            // If service returns strict firestore query order (desc), then [Newest, ..., Oldest]
            // We need to reverse it to [Oldest, ..., Newest] for chat UI.
            setMessages(newMessages.reverse()); // Careful: reversing mutates if not copied, but newMessages is usually fresh array
        });
        return () => unsub();
    }, [communityId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages.length]); // Scroll on new messages (basic logic, might need refinement to not scroll on load old)

    const handleSend = async () => {
        if (!inputText.trim() || !user) return;
        setSending(true);
        try {
            const clientId = `client_${Date.now()}`; // Simple client ID
            await communityChatService.sendMessage(
                communityId,
                inputText,
                { uid: user.uid, displayName: user.displayName || 'User', photoURL: user.photoURL || '' },
                clientId
            );
            setInputText('');
        } catch (e) {
            console.error("Failed to send", e);
        } finally {
            setSending(false);
        }
    };

    const handleLoadMore = async () => {
        if (messages.length === 0 || loadingMore) return;
        setLoadingMore(true);
        // oldest message is messages[0] because we reversed them
        const oldestMsg = messages[0];

        try {
            const res = await communityChatService.loadMoreMessages(communityId, oldestMsg.id, 20);
            if (res.messages.length > 0) {
                // Determine hasMore
                if (res.messages.length < 20) setHasMore(false);

                // Prepend older messages (returned desc, so reverse them to be [Older...Newer])
                const olderMessages = res.messages.reverse();
                setMessages(prev => [...olderMessages, ...prev]);
            } else {
                setHasMore(false);
            }
        } catch (e) {
            console.error("Failed to load older messages", e);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleDelete = async (msgId: string) => {
        if (!user) return;
        if (confirm(t('chat.deleteConfirm'))) {
            await communityChatService.softDeleteMessage(communityId, msgId, user.uid);
        }
    };

    const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner';

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column' }}>
                {hasMore && messages.length >= 50 && (
                    <Button
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                        size="small"
                        sx={{ alignSelf: 'center', mb: 2 }}
                    >
                        {loadingMore ? t('chat.loading') : t('chat.loadOlder')}
                    </Button>
                )}

                {messages.map((msg, index) => {
                    const isMe = msg.senderId === user?.uid;
                    const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId;

                    return (
                        <Box
                            key={msg.id}
                            sx={{
                                alignSelf: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '75%',
                                mb: 1
                            }}
                        >
                            {showHeader && !isMe && (
                                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                    {msg.senderName}
                                </Typography>
                            )}
                            <Paper
                                elevation={1}
                                sx={{
                                    p: 1.5,
                                    bgcolor: isMe ? 'primary.main' : 'white',
                                    color: isMe ? 'white' : 'text.primary',
                                    borderRadius: 2,
                                    borderTopRightRadius: isMe ? 0 : 2,
                                    borderTopLeftRadius: !isMe ? 0 : 2,
                                    position: 'relative'
                                }}
                            >
                                <Typography variant="body2">{msg.isDeleted ? <i>{t('chat.deleted')}</i> : msg.content}</Typography>
                                <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, opacity: 0.7, fontSize: '0.65rem' }}>
                                    {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : 'Pending'}
                                </Typography>

                                {(isMe || isAdmin) && !msg.isDeleted && (
                                    <IconButton
                                        size="small"
                                        sx={{
                                            position: 'absolute', top: -10, right: -10,
                                            bgcolor: 'background.paper', boxShadow: 1,
                                            width: 22, height: 22,
                                            opacity: 0.35,
                                            '&:hover': { opacity: 1, bgcolor: 'error.50' }
                                        }}
                                        onClick={() => handleDelete(msg.id)}
                                    >
                                        <Trash2 size={12} color="red" />
                                    </IconButton>
                                )}
                            </Paper>
                        </Box>
                    );
                })}
                <div ref={messagesEndRef} />
            </Box>

            <Box sx={{ p: 1.5, bgcolor: 'background.paper', display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                    fullWidth
                    size="small"
                    placeholder={!user ? t('chat.signInPrompt') : t('chat.placeholder')}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    sx={{ bgcolor: 'action.hover', borderRadius: 1 }}
                    InputProps={{ sx: { borderRadius: 4 } }}
                    disabled={!user || sending}
                />
                <IconButton color="primary" disabled={!user || !inputText.trim() || sending} onClick={handleSend}>
                    <Send />
                </IconButton>
            </Box>
        </Box>
    );
};
