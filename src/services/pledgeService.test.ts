import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../lib/firebase';
import { writeBatch } from 'firebase/firestore';
import { pledgeService } from './pledgeService';
import { User } from 'firebase/auth';

describe('pledgeService', () => {
    let mockUser: User;

    beforeEach(() => {
        vi.clearAllMocks();
        mockUser = {
            uid: 'test-user-id',
            displayName: 'Test User',
        } as User;

        expect(mockUser.uid).toBe('test-user-id');
    });

    describe('joinPledge (Batch Commit Success)', () => {
        it('should successfully execute a batch write when joining a pledge', async () => {
            const mockPledge = {
                id: 'pledge-123',
                title: 'Test Pledge',
                description: 'A test pledge',
                targetMalas: 100,
                currentMalas: 0,
                participants: 0
            };

            await pledgeService.joinPledge(mockPledge, mockUser);

            expect(writeBatch).toHaveBeenCalledWith(db);
            const batchMock = vi.mocked(writeBatch).mock.results[0].value;

            expect(batchMock.set).toHaveBeenCalled(); // sets participation
            expect(batchMock.update).toHaveBeenCalled(); // increments participants counter
            expect(batchMock.commit).toHaveBeenCalled(); // commits batch
        });
    });

    describe('getMyPledges (Offline / Fallback Behavior)', () => {
        it('should fallback to local store if Firebase times out', async () => {
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockImplementationOnce(() => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('FIREBASE_TIMEOUT')), 50);
                });
            });

            vi.useFakeTimers();

            const promise = pledgeService.getMyPledges('test-user-id');
            vi.advanceTimersByTime(100);
            const result = await promise;

            // Falls back to mock — returns empty array for a user with no mock participants
            expect(Array.isArray(result)).toBe(true);

            vi.useRealTimers();
        });
    });
});
