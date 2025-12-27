import { db } from '../lib/firebase';
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc,
    query, where, orderBy, limit, startAfter, Timestamp,
    serverTimestamp, increment, DocumentSnapshot,
    runTransaction
} from 'firebase/firestore';
import { CommunityPost, PostType, UserProfileSummary } from '../types/community';
import { runWithFallback } from './resilience';
import { localStore } from './localStore';

export const communityFeedService = {

    /**
     * List posts from a community
     */
    listPosts: async (communityId: string, limitCount: number = 20, lastDoc?: DocumentSnapshot): Promise<{ posts: CommunityPost[], lastDoc: DocumentSnapshot | null }> => {
        return runWithFallback(
            async () => {
                let q = query(
                    collection(db, 'communities', communityId, 'posts'),
                    where('isDeleted', '==', false),
                    orderBy('createdAt', 'desc'),
                    limit(limitCount)
                );

                if (lastDoc) {
                    q = query(q, startAfter(lastDoc));
                }

                const snapshot = await getDocs(q);
                const posts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CommunityPost));

                return {
                    posts,
                    lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
                };
            },
            async () => {
                // Mock Fallback
                const posts = localStore.getPosts(communityId);
                // Pagination not really supported in mock local store for now, returning all (or slice)
                // If we want to support basic pagination we could use params but for demo mode often all is fine.
                return {
                    posts: posts.slice(0, limitCount),
                    lastDoc: null
                };
            },
            "List Community Posts"
        );
    },

    /**
     * Create a new post
     */
    createPost: async (communityId: string, type: PostType, content: string, author: UserProfileSummary): Promise<CommunityPost> => {
        return runWithFallback(
            async () => {
                const postsRef = collection(db, 'communities', communityId, 'posts');

                const newPost: Omit<CommunityPost, 'id'> = {
                    communityId,
                    author,
                    type,
                    content,
                    createdAt: serverTimestamp() as Timestamp,
                    likesCount: 0,
                    commentCount: 0,
                    isDeleted: false
                };

                const docRef = await addDoc(postsRef, newPost);

                return {
                    id: docRef.id,
                    ...newPost,
                    createdAt: Timestamp.now()
                };
            },
            async () => {
                // Mock/Offline Fallback
                const newPost: CommunityPost = {
                    id: `mock_post_${Date.now()}`,
                    communityId,
                    author,
                    type,
                    content,
                    createdAt: Timestamp.now(),
                    likesCount: 0,
                    commentCount: 0,
                    isDeleted: false
                };
                localStore.addPost(newPost);
                return newPost;
            },
            "Create Community Post"
        );
    },

    /**
     * Like a post (Toggle)
     */
    likePost: async (communityId: string, postId: string, uid: string): Promise<boolean> => {
        const postRef = doc(db, 'communities', communityId, 'posts', postId);
        const likeRef = doc(db, 'communities', communityId, 'posts', postId, 'likes', uid);

        let liked = false;

        await runTransaction(db, async (transaction) => {
            const likeDoc = await transaction.get(likeRef);
            if (likeDoc.exists()) {
                // Unlike
                transaction.delete(likeRef);
                transaction.update(postRef, { likesCount: increment(-1) });
                liked = false;
            } else {
                // Like
                transaction.set(likeRef, { uid, likedAt: serverTimestamp() });
                transaction.update(postRef, { likesCount: increment(1) });
                liked = true;
            }
        });

        return liked;
    },

    /**
     * Soft delete a post
     */
    softDeletePost: async (communityId: string, postId: string, requesterUid: string): Promise<void> => {
        const postRef = doc(db, 'communities', communityId, 'posts', postId);
        const snap = await getDoc(postRef);

        if (!snap.exists()) throw new Error("Post not found");

        // const post = snap.data() as CommunityPost;

        // Permission check: Author or Admin (Role checking should be enforced via Rules or passed context)
        // Here we just record who deleted it.

        await updateDoc(postRef, {
            isDeleted: true,
            deletedBy: requesterUid,
            updatedAt: serverTimestamp()
        });
    }
};
