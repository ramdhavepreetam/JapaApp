import { logEvent } from 'firebase/analytics';
import { analytics } from './firebase';

const safeLog = (eventName: string, params?: Record<string, unknown>) => {
    if (!analytics) return;
    try { logEvent(analytics, eventName, params); } catch {}
};

export const track = {
    japaCompleted: (malas: number) =>
        safeLog('japa_completed', { malas }),

    communityJoined: (communityId: string) =>
        safeLog('community_joined', { communityId }),

    pledgeContributed: (pledgeId: string, malas: number) =>
        safeLog('pledge_contributed', { pledgeId, malas }),

    syncFailed: () =>
        safeLog('sync_failed'),
};
