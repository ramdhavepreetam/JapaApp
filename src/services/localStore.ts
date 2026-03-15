import { Community, CommunityMember, ChatMessage, CommunityPost, JapaEntry } from '../types/community';
// import { Timestamp } from 'firebase/firestore';

const KEY_COMMUNITIES = 'japa_v1_communities';
const KEY_MEMBERS = 'japa_v1_members';
const KEY_CHATS = 'japa_v1_chats';
const KEY_POSTS = 'japa_v1_posts';
const KEY_JAPA_QUEUE = 'japa_v1_queue_japa';
const KEY_CHAT_QUEUE = 'japa_v1_queue_chat';

// --- TYPES ---

export interface QueuedJapaEntry extends JapaEntry {
    queuedAt: number; // ms
}

export interface QueuedChatMessage extends Omit<ChatMessage, 'id'> {
    tempId: string;
    queuedAt: number;
}

// --- STORE IMPLEMENTATION ---

export const localStore = {

    // --- Communities ---

    cacheCommunities: (communities: Community[]) => {
        try {
            // Merge with existing to preserve local-only ones if any? 
            // For now simplest is replacement of the "Cache" part, 
            // but we might want to keep "Mock" ones. 
            // Let's just store the list.
            localStorage.setItem(KEY_COMMUNITIES, JSON.stringify(communities));
        } catch (e) { console.warn("Quota exceeded for local cache", e); }
    },

    getCommunities: (): Community[] => {
        const stored = localStorage.getItem(KEY_COMMUNITIES);
        if (stored) return JSON.parse(stored);

        // Return defaults if nothing
        return [{
            id: 'mock_comm_1',
            name: 'Global Peace (Offline Demo)',
            description: 'A dedicated space for world peace chanting. (You are offline)',
            creatorId: 'mock_admin',
            createdAt: { seconds: Date.now() / 1000, nanoseconds: 0 } as any,
            isPrivate: false,
            requiresApproval: false,
            membersCount: 120,
            totalMalas: 5000,
            totalMantras: 540000,
            tags: ['peace', 'global']
        }];
    },

    getCommunity: (id: string): Community | null => {
        const list = localStore.getCommunities();
        return list.find(c => c.id === id) || null;
    },

    createCommunity: (comm: Community) => {
        const list = localStore.getCommunities();
        list.push(comm);
        localStorage.setItem(KEY_COMMUNITIES, JSON.stringify(list));
    },

    // --- Members ---

    joinCommunity: (member: CommunityMember) => {
        const stored = localStorage.getItem(KEY_MEMBERS);
        const members: CommunityMember[] = stored ? JSON.parse(stored) : [];
        // Dedup
        const idx = members.findIndex(m => m.communityId === member.communityId && m.uid === member.uid);
        let isNewMember = false;
        if (idx >= 0) {
            members[idx] = member;
        } else {
            members.push(member);
            isNewMember = true;
        }
        localStorage.setItem(KEY_MEMBERS, JSON.stringify(members));

        // Update community count ONLY if it's a net new member
        if (isNewMember) {
            const comms = localStore.getCommunities();
            const comm = comms.find(c => c.id === member.communityId);
            if (comm) {
                comm.membersCount++;
                localStorage.setItem(KEY_COMMUNITIES, JSON.stringify(comms));
            }
        }
    },

    getMember: (communityId: string, uid: string): CommunityMember | null => {
        const stored = localStorage.getItem(KEY_MEMBERS);
        if (!stored) return null;
        const members: CommunityMember[] = JSON.parse(stored);
        return members.find(m => m.communityId === communityId && m.uid === uid) || null;
    },

    getMyCommunities: (uid: string): { communityId: string, role: string }[] => {
        const stored = localStorage.getItem(KEY_MEMBERS);
        if (!stored) return [];
        const members: CommunityMember[] = JSON.parse(stored);
        return members.filter(m => m.uid === uid && m.status === 'active').map(m => ({
            communityId: m.communityId,
            role: m.role
        }));
    },

    // --- Chat ---

    getChatMessages: (communityId: string): ChatMessage[] => {
        const stored = localStorage.getItem(KEY_CHATS);
        const allMessages: ChatMessage[] = stored ? JSON.parse(stored) : [];
        return allMessages.filter(m => m.communityId === communityId)
            .sort((a, b) => (b.createdAt as any).seconds - (a.createdAt as any).seconds); // Desc
    },

    addChatMessage: (msg: ChatMessage) => {
        const stored = localStorage.getItem(KEY_CHATS);
        const allMessages: ChatMessage[] = stored ? JSON.parse(stored) : [];
        allMessages.push(msg);
        localStorage.setItem(KEY_CHATS, JSON.stringify(allMessages));
    },

    // --- Posts ---

    getPosts: (communityId: string): CommunityPost[] => {
        const stored = localStorage.getItem(KEY_POSTS);
        const posts: CommunityPost[] = stored ? JSON.parse(stored) : [];
        return posts.filter(p => p.communityId === communityId)
            .sort((a, b) => (b.createdAt as any).seconds - (a.createdAt as any).seconds);
    },

    addPost: (post: CommunityPost) => {
        const stored = localStorage.getItem(KEY_POSTS);
        const posts: CommunityPost[] = stored ? JSON.parse(stored) : [];
        posts.push(post);
        localStorage.setItem(KEY_POSTS, JSON.stringify(posts));
    },

    // --- QUEUES ---

    queueJapaEntry: (entry: JapaEntry) => {
        // 1. Update Mock State (Optimistic)
        const comms = localStore.getCommunities();
        const comm = comms.find(c => c.id === entry.communityId);
        if (comm) {
            comm.totalMalas += entry.malas;
            comm.totalMantras += entry.mantras;
            localStorage.setItem(KEY_COMMUNITIES, JSON.stringify(comms));
        }

        // Update Member Mock State
        const mem = localStore.getMember(entry.communityId, entry.userId);
        if (mem) {
            mem.totalMalas += entry.malas;
            mem.totalMantras += entry.mantras;
            // Save member back
            const stored = localStorage.getItem(KEY_MEMBERS);
            const members: CommunityMember[] = stored ? JSON.parse(stored) : [];
            const idx = members.findIndex(m => m.communityId === entry.communityId && m.uid === entry.userId);
            if (idx >= 0) {
                members[idx] = mem;
                localStorage.setItem(KEY_MEMBERS, JSON.stringify(members));
            }
        }

        // 2. Add to Queue (Only if it's a real community ID, i.e. not starting with mock_)
        // OR we queue everything and let syncService decide. Cleanest to queue all.
        const storedQ = localStorage.getItem(KEY_JAPA_QUEUE);
        const queue: QueuedJapaEntry[] = storedQ ? JSON.parse(storedQ) : [];

        // Idempotency check in queue
        if (queue.find(q => q.id === entry.id)) return;

        queue.push({ ...entry, queuedAt: Date.now() });
        localStorage.setItem(KEY_JAPA_QUEUE, JSON.stringify(queue));
    },

    queueChatMessage: (msg: Omit<ChatMessage, 'id'>, tempId: string) => {
        // 1. Update Mock State
        const fullMsg: ChatMessage = {
            id: tempId,
            ...msg
        };
        localStore.addChatMessage(fullMsg);

        // 2. Add to Queue
        const storedQ = localStorage.getItem(KEY_CHAT_QUEUE);
        const queue: QueuedChatMessage[] = storedQ ? JSON.parse(storedQ) : [];

        queue.push({ ...msg, tempId, queuedAt: Date.now() });
        localStorage.setItem(KEY_CHAT_QUEUE, JSON.stringify(queue));
    },

    getJapaQueue: (): QueuedJapaEntry[] => {
        const stored = localStorage.getItem(KEY_JAPA_QUEUE);
        return stored ? JSON.parse(stored) : [];
    },

    getChatQueue: (): QueuedChatMessage[] => {
        const stored = localStorage.getItem(KEY_CHAT_QUEUE);
        return stored ? JSON.parse(stored) : [];
    },

    clearJapaQueueItem: (id: string) => {
        const queue = localStore.getJapaQueue();
        const newQueue = queue.filter(q => q.id !== id);
        localStorage.setItem(KEY_JAPA_QUEUE, JSON.stringify(newQueue));
    },

    clearChatQueueItem: (tempId: string) => {
        const queue = localStore.getChatQueue();
        const newQueue = queue.filter(q => q.tempId !== tempId);
        localStorage.setItem(KEY_CHAT_QUEUE, JSON.stringify(newQueue));
    },

    clearAllQueues: () => {
        localStorage.removeItem(KEY_JAPA_QUEUE);
        localStorage.removeItem(KEY_CHAT_QUEUE);
    }
};
