import { Timestamp } from 'firebase/firestore';

export type UserRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface UserProfileSummary {
    uid: string;
    displayName: string;
    photoURL: string;
}

export interface Community {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    creatorId: string;
    createdAt: Timestamp;
    isPrivate: boolean;
    requiresApproval: boolean;
    inviteCode?: string; // For joining via code
    membersCount: number;
    totalMalas: number; // Aggregate
    totalMantras: number; // Aggregate
    tags: string[];
    chatEnabled?: boolean;
    feedEnabled?: boolean;
    counterEnabled?: boolean;
}

export interface CommunityMember {
    uid: string;
    communityId: string;
    role: UserRole;
    joinedAt: Timestamp;
    totalMalas: number; // Contributed to this community
    totalMantras: number;
    status: 'active' | 'banned' | 'left';
    lastReadAnnouncementsAt?: Timestamp;
    lastReadChatAt?: Timestamp;
}

export interface JoinRequest {
    id: string; // communityId_uid
    communityId: string;
    user: UserProfileSummary;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: Timestamp;
}

export type PostType = 'text' | 'image' | 'announcement';

export interface CommunityPost {
    id: string;
    communityId: string;
    author: UserProfileSummary;
    type: PostType;
    content: string; // Text or Image URL
    createdAt: Timestamp;
    updatedAt?: Timestamp;
    likesCount: number;
    commentCount: number;
    isDeleted?: boolean;
    deletedBy?: string;
}

export interface ChatMessage {
    id: string;
    communityId: string;
    senderId: string;
    senderName: string;
    senderPhotoURL?: string;
    content: string;
    createdAt: Timestamp;
    likes: string[]; // List of UIDs who liked
    replyToId?: string;
    isDeleted?: boolean;
    clientId?: string; // For dedup/optimistic UI
}

export interface JapaEntry {
    id: string; // specific ID logic or auto-id
    userId: string;
    communityId: string;
    malas: number;
    mantras: number;
    timestamp: Timestamp;
    // Idempotency key if needed separate from ID
}

export interface Notification {
    id: string;
    type: 'announcement' | 'mention' | 'reply' | 'join_request' | 'role_change';
    title: string;
    body: string;
    link?: string; // internal app link
    read: boolean;
    createdAt: Timestamp;
    data?: any;
}
