import { db } from '../lib/firebase';
import { doc, runTransaction, getDoc } from 'firebase/firestore';
import { runWithFallback } from './resilience';

export type ReactionType = 'pranams' | 'heart' | 'sparkle';

export interface JapaReactions {
  pranams: number;
  heart: number;
  sparkle: number;
  reactors: Record<string, ReactionType>;
}

const empty = (): JapaReactions => ({ pranams: 0, heart: 0, sparkle: 0, reactors: {} });

export const japaReactionService = {
  toggleReaction: async (
    communityId: string,
    entryId: string,
    uid: string,
    type: ReactionType
  ): Promise<JapaReactions> => {
    return runWithFallback(
      async () => {
        const ref = doc(db, 'communities', communityId, 'japa_entry_reactions', entryId);
        let result: JapaReactions = empty();

        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(ref);
          const data: JapaReactions = snap.exists() ? (snap.data() as JapaReactions) : empty();

          const existing = data.reactors[uid] as ReactionType | undefined;
          const newReactors = { ...data.reactors };
          const counts = { pranams: data.pranams, heart: data.heart, sparkle: data.sparkle };

          if (existing === type) {
            delete newReactors[uid];
            counts[type] = Math.max(0, counts[type] - 1);
          } else {
            if (existing) counts[existing] = Math.max(0, counts[existing] - 1);
            newReactors[uid] = type;
            counts[type] = counts[type] + 1;
          }

          result = { ...counts, reactors: newReactors };
          transaction.set(ref, result);
        });

        return result;
      },
      async () => empty(),
      'Toggle Japa Reaction'
    );
  },

  getBatchReactions: async (
    communityId: string,
    entryIds: string[]
  ): Promise<Record<string, JapaReactions>> => {
    if (entryIds.length === 0) return {};
    return runWithFallback(
      async () => {
        const snaps = await Promise.all(
          entryIds.map(id =>
            getDoc(doc(db, 'communities', communityId, 'japa_entry_reactions', id))
          )
        );
        return Object.fromEntries(
          snaps.map((snap, i) => [entryIds[i], snap.exists() ? (snap.data() as JapaReactions) : empty()])
        );
      },
      async () => Object.fromEntries(entryIds.map(id => [id, empty()])),
      'Get Batch Japa Reactions'
    );
  }
};
