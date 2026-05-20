import { db, auth } from '../lib/firebase';
import {
  collection, doc, addDoc, serverTimestamp,
  query, orderBy, limit, getDocs, updateDoc,
  where, startAfter, QueryDocumentSnapshot, DocumentData, QueryConstraint
} from 'firebase/firestore';
import { runWithFallback } from './resilience';

export type FeedbackCategory = 'bug' | 'feature' | 'general';
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

export interface AppFeedback {
  id?: string;
  uid: string;
  displayName: string;
  email: string;
  category: FeedbackCategory;
  message: string;
  appVersion: string;
  createdAt: any;
  status: FeedbackStatus;
  adminNotes: string;
}

export interface FeedbackPage {
  items: AppFeedback[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export const feedbackService = {
  submit: async (category: FeedbackCategory, message: string): Promise<void> => {
    const user = auth.currentUser;
    if (!user) throw new Error('Must be signed in');

    return runWithFallback(
      async () => {
        await addDoc(collection(db, 'app_feedback'), {
          uid: user.uid,
          displayName: user.displayName || 'Anonymous',
          email: user.email || '',
          category,
          message: message.trim(),
          appVersion: '1.0',
          createdAt: serverTimestamp(),
          status: 'new',
          adminNotes: ''
        });
      },
      async () => {
        throw new Error('Offline: cannot submit feedback without connection');
      },
      'Submit App Feedback'
    );
  },

  getFeedback: async (limitCount: number = 50): Promise<AppFeedback[]> => {
    const q = query(
      collection(db, 'app_feedback'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppFeedback));
  },

  updateStatus: async (id: string, status: FeedbackStatus, adminNotes?: string): Promise<void> => {
    const updates: Record<string, unknown> = { status };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    await updateDoc(doc(db, 'app_feedback', id), updates);
  },

  getActiveFeedback: async (
    pageSize = 20,
    cursor?: QueryDocumentSnapshot<DocumentData>
  ): Promise<FeedbackPage> => {
    const constraints: QueryConstraint[] = [
      where('status', 'in', ['new', 'reviewed']),
      orderBy('createdAt', 'desc'),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize + 1));

    const snap = await getDocs(query(collection(db, 'app_feedback'), ...constraints));
    const hasMore = snap.docs.length > pageSize;
    const docs = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    return {
      items: docs.map(d => ({ id: d.id, ...d.data() } as AppFeedback)),
      cursor: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore,
    };
  }
};
