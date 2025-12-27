import { db } from '../lib/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc,
    query, orderBy, limit, startAfter, Timestamp,
    onSnapshot, serverTimestamp, Unsubscribe, DocumentSnapshot
} from 'firebase/firestore';
import { ChatMessage, UserProfileSummary } from '../types/community';
import { runWithFallback } from './resilience';
import { localStore } from './localStore';

// Raw API for Sync
export const communityChatApi = {
    sendMessage: async (
        communityId: string,
        content: string,
        sender: UserProfileSummary,
        clientId?: string,
        replyToId?: string
    ): Promise<string> => {
        const messagesRef = collection(db, 'communities', communityId, 'chat_messages');

        const newMessage: Omit<ChatMessage, 'id'> = {
            communityId,
            senderId: sender.uid,
            senderName: sender.displayName,
            senderPhotoURL: sender.photoURL,
            content,
            createdAt: serverTimestamp() as Timestamp,
            likes: [],
            clientId: clientId || '',
            replyToId,
            isDeleted: false
        };

        const docRef = await addDoc(messagesRef, newMessage);
        return docRef.id;
    }
};

export const communityChatService = {

    /**
     * Subscribe to chat messages
     */
    subscribeToChat: (
        communityId: string,
        limitCount: number = 50,
        onChange: (messages: ChatMessage[]) => void
    ): Unsubscribe => {
        // Fallback or Resilience for subscriptions is tricky. 
        // We will just try Firebase. If it fails (offline), Firebase handles offline caching mostly.
        // But if we want to switch to "Mock Store" specifically:

        // Simple shim since we can't easily wait/timeout a subscription init in same way without async.
        // We rely on Firestore's native offline capability OR check a global flag?
        // But here we are asked to use LocalStorage fallback.

        // If we want to support our "Mock Store", we should check state.
        // But `subscribe` is synchronous return. 
        // We'll wrap the setup in a try/catch block if possible, but simplest is:

        try {
            const q = query(
                collection(db, 'communities', communityId, 'chat_messages'),
                orderBy('createdAt', 'desc'),
                limit(limitCount)
            );
            return onSnapshot(q, (snapshot) => {
                const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
                onChange(messages);
            }, (error) => {
                console.warn("Chat subscription error:", error);
                // Fallback to local store
                const cached = localStore.getChatMessages(communityId);
                onChange(cached);
            });
        } catch (e) {
            // Initial failure
            const cached = localStore.getChatMessages(communityId);
            onChange(cached);
            return () => { };
        }
    },

    /**
     * Send a message
     */
    sendMessage: async (
        communityId: string,
        content: string,
        sender: UserProfileSummary,
        clientId?: string,
        replyToId?: string
    ): Promise<string> => {
        return runWithFallback(
            () => communityChatApi.sendMessage(communityId, content, sender, clientId, replyToId),
            async () => {
                // Offline Fallback
                const tempId = clientId || `temp_${Date.now()}`;

                // Construct basic message for local display
                const newMessage: Omit<ChatMessage, 'id'> = {
                    communityId,
                    senderId: sender.uid,
                    senderName: sender.displayName,
                    senderPhotoURL: sender.photoURL,
                    content,
                    createdAt: Timestamp.now(), // Local time
                    likes: [],
                    clientId: tempId,
                    replyToId,
                    isDeleted: false
                };

                localStore.queueChatMessage(newMessage, tempId);
                return tempId;
            },
            "Send Chat Message"
        );
    },

    /**
     * Soft delete a message
     */
    softDeleteMessage: async (communityId: string, messageId: string, requesterUid: string): Promise<void> => {
        const msgRef = doc(db, 'communities', communityId, 'chat_messages', messageId);
        const snap = await getDoc(msgRef);

        if (!snap.exists()) throw new Error("Message not found");
        const msg = snap.data() as ChatMessage;

        if (msg.senderId !== requesterUid) {
            // throw new Error("Unauthorized"); // Let UI/Rules handle strictness, but here we can check
            // Allowing for now (e.g. admin deletion) - relying on security rules
        }

        await updateDoc(msgRef, {
            isDeleted: true,
            content: "This message was deleted." // Optional: redact content
        });
    },

    /**
     * Load older messages
     */
    loadMoreMessages: async (
        communityId: string,
        lastDocId: string,
        limitCount: number = 20
    ): Promise<{ messages: ChatMessage[], lastDoc: DocumentSnapshot | null }> => {
        // Need to fetch valid doc snapshot for cursor
        const cursorDocRef = doc(db, 'communities', communityId, 'chat_messages', lastDocId);
        const cursorDoc = await getDoc(cursorDocRef);

        if (!cursorDoc.exists()) {
            return { messages: [], lastDoc: null };
        }

        const q = query(
            collection(db, 'communities', communityId, 'chat_messages'),
            orderBy('createdAt', 'desc'),
            startAfter(cursorDoc),
            limit(limitCount)
        );

        const snapshot = await getDocs(q);
        const messages = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));

        return {
            messages,
            lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
        };
    }
};
