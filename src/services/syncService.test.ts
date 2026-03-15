import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncService } from './syncService';
import { localStore } from './localStore';
import { communityJapaApi } from './communityJapaService';
import { communityChatApi } from './communityChatService';

// Mock dependencies
vi.mock('./localStore', () => ({
    localStore: {
        getJapaQueue: vi.fn(),
        getChatQueue: vi.fn(),
        clearJapaQueueItem: vi.fn(),
        clearChatQueueItem: vi.fn(),
    }
}));

vi.mock('./communityJapaService', () => ({
    communityJapaApi: {
        submitJapaEntry: vi.fn()
    }
}));

vi.mock('./communityChatService', () => ({
    communityChatApi: {
        sendMessage: vi.fn()
    }
}));

describe('syncService', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        syncService.isSyncing = false;
        
        // Mock navigator.onLine explicitly per test to ensure it's Online
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should drain Japa queue FIFO on reconnect', async () => {
        const mockQueue = [
            { id: 'entry-1', communityId: 'comm-1', malas: 1 },
            { id: 'entry-2', communityId: 'comm-1', malas: 2 }
        ];
        
        vi.mocked(localStore.getJapaQueue).mockReturnValue(mockQueue as any);
        vi.mocked(localStore.getChatQueue).mockReturnValue([]);
        vi.mocked(communityJapaApi.submitJapaEntry).mockResolvedValue(undefined as any);

        await syncService.syncAll();

        // 1. Pulled from local store
        expect(localStore.getJapaQueue).toHaveBeenCalled();

        // 2. Sent in order
        expect(communityJapaApi.submitJapaEntry).toHaveBeenNthCalledWith(1, 'comm-1', mockQueue[0]);
        expect(communityJapaApi.submitJapaEntry).toHaveBeenNthCalledWith(2, 'comm-1', mockQueue[1]);

        // 3. Cleared from store in order
        expect(localStore.clearJapaQueueItem).toHaveBeenNthCalledWith(1, 'entry-1');
        expect(localStore.clearJapaQueueItem).toHaveBeenNthCalledWith(2, 'entry-2');
    });

    it('should drain Chat queue on reconnect', async () => {
         const mockChatQueue = [
            { tempId: 'temp-1', communityId: 'comm-2', content: 'hello', senderId: 'user1', senderName: 'Alice' }
        ];

        vi.mocked(localStore.getJapaQueue).mockReturnValue([]);
        vi.mocked(localStore.getChatQueue).mockReturnValue(mockChatQueue as any);
        vi.mocked(communityChatApi.sendMessage).mockResolvedValue(undefined as any);

        await syncService.syncAll();

         // 1. Pulled from local store
         expect(localStore.getChatQueue).toHaveBeenCalled();

         // 2. Sent
         expect(communityChatApi.sendMessage).toHaveBeenCalledWith(
             'comm-2',
             'hello',
             { uid: 'user1', displayName: 'Alice', photoURL: '' },
             undefined, // clientId since we mocked without it easily
             undefined  // replyToId
         );

         // 3. Cleared from store
         expect(localStore.clearChatQueueItem).toHaveBeenCalledWith('temp-1');
    });

    it('should not sync if offline', async () => {
        vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
        vi.mocked(localStore.getJapaQueue).mockReturnValue([{ id: 'mock-id' }] as any);

        await syncService.syncAll();

        expect(communityJapaApi.submitJapaEntry).not.toHaveBeenCalled();
        expect(localStore.clearJapaQueueItem).not.toHaveBeenCalled();
    });
});
