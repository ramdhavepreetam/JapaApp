import { localStore } from './localStore';
import { communityJapaApi } from './communityJapaService';
import { communityChatApi } from './communityChatService'; // We need to check if this export works, I added it.
import { resetFallbackState } from './resilience'; // To reset mock mode if we successfully sync
import { track } from '../lib/analytics';

// Exponential backoff retry — emits 'sync:failed' after exhausting all attempts
async function retrySync(fn: () => Promise<void>, attempts = 3): Promise<void> {
    for (let i = 0; i < attempts; i++) {
        try {
            await fn();
            return;
        } catch (e) {
            if (i === attempts - 1) {
                track.syncFailed();
                window.dispatchEvent(new CustomEvent('sync:failed'));
                throw e;
            }
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
}

export const syncService = {

    isSyncing: false,

    syncAll: async () => {
        if (syncService.isSyncing) return;
        if (!navigator.onLine) return; // Basic check

        // Clear the sticky fallback flag before each sync attempt so calls
        // go to Firestore rather than staying in localStorage.
        resetFallbackState();

        syncService.isSyncing = true;
        console.log("Starting Sync...");

        try {
            await retrySync(() => syncService.syncJapaEntries());
            await retrySync(() => syncService.syncChatMessages());

            // If we successfully synced, it suggests we are online.
            // We can optionally attempt to reset the generic fallback state.
            resetFallbackState();

        } catch (e) {
            console.error("Sync failed after retries:", e);
        } finally {
            syncService.isSyncing = false;
        }
    },

    syncJapaEntries: async () => {
        const queue = localStore.getJapaQueue();
        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} Japa entries...`);

        // Process sequentially to be safe
        for (const entry of queue) {
            try {
                // We use the raw API to bypass the resilience wrapper (so we don't just mock it again)
                await communityJapaApi.submitJapaEntry(entry.communityId, entry);

                // Success: Remove from queue
                localStore.clearJapaQueueItem(entry.id);
            } catch (e: any) {
                console.error(`Failed to sync Japa Entry ${entry.id}`, e);
                // If permanent error, maybe remove? 
                // If network error, keep.
                // Assuming "Idempotent" handling in API will catch duplicates.
            }
        }
    },

    syncChatMessages: async () => {
        const queue = localStore.getChatQueue();
        if (queue.length === 0) return;

        console.log(`Syncing ${queue.length} Chat messages...`);

        for (const item of queue) {
            try {
                // Reconstruct params
                const sender = {
                    uid: item.senderId,
                    displayName: item.senderName,
                    photoURL: item.senderPhotoURL || ''
                };

                // Use Raw API
                await communityChatApi.sendMessage(
                    item.communityId,
                    item.content,
                    sender,
                    item.clientId, // Pass the known clientId/tempId
                    item.replyToId
                );

                // Success: Remove
                localStore.clearChatQueueItem(item.tempId);

            } catch (e: any) {
                console.error(`Failed to sync Chat Message ${item.tempId}`, e);
            }
        }
    }
};

// Listen for Online event
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log("App is Online. Triggering Sync.");
        syncService.syncAll();
    });

    // Initial sync on load (with small delay to ensure auth etc is ready?)
    setTimeout(() => {
        syncService.syncAll();
    }, 5000);
}
