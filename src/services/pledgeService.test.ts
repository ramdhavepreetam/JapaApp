import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../lib/firebase';
import { writeBatch } from 'firebase/firestore';
import { pledgeService as communityService } from './pledgeService';
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
        
        // Reset the mock fallback state exposed within the test env implicitly.
        // We ensure a fresh start by asserting normal behavior initially.
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

            await communityService.joinPledge(mockPledge, mockUser);

            expect(writeBatch).toHaveBeenCalledWith(db);
            const batchMock = vi.mocked(writeBatch).mock.results[0].value;
            
            expect(batchMock.set).toHaveBeenCalled(); // sets participation
            expect(batchMock.update).toHaveBeenCalled(); // increments participants counter
            expect(batchMock.commit).toHaveBeenCalled(); // commits batch
        });
    });

    describe('Offline / Fallback Behavior', () => {
        it('should fallback to local store/mock implementation if Firebase times out', async () => {
            
            // Mock getDocs to simulate a timeout locally when running fallback
            const { getDocs } = await import('firebase/firestore');
            vi.mocked(getDocs).mockImplementationOnce(() => {
                return new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('FIREBASE_TIMEOUT')), 50);
                });
            });

            // Adjust fake timers and use them carefully here
            vi.useFakeTimers();

            const getPledgesPromise = communityService.getPledges();
            
            // Fast-forward to trigger the timeout rejection
            vi.advanceTimersByTime(100);
            
            const pledges = await getPledgesPromise;
            
            // Should return the mock default pledges
            expect(pledges.length).toBeGreaterThan(0);
                         expect(pledges[0].id).toBe('mock_1');
            
            vi.useRealTimers();
        });
    });
});
