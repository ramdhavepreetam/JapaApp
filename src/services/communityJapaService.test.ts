import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTransaction } from 'firebase/firestore';
import { communityJapaApi, communityJapaService } from './communityJapaService';
import { localStore } from './localStore';
import { resetFallbackState } from './resilience';
import { JapaEntry } from '../types/community';

describe('communityJapaService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetFallbackState();
    });

    describe('submitJapaEntry validation', () => {
        it('rejects a non-positive mala count without touching Firestore', async () => {
            const entry: JapaEntry = {
                id: 'e1', communityId: 'c1', userId: 'u1', malas: 0, mantras: 0
            } as JapaEntry;

            await expect(communityJapaService.submitJapaEntry('c1', entry)).rejects.toThrow(
                'Mala count must be a positive number.'
            );
            expect(runTransaction).not.toHaveBeenCalled();
        });

        it('rejects a mala count above the 10,000 cap', async () => {
            const entry: JapaEntry = {
                id: 'e1', communityId: 'c1', userId: 'u1', malas: 10001, mantras: 0
            } as JapaEntry;

            await expect(communityJapaService.submitJapaEntry('c1', entry)).rejects.toThrow(
                'Please enter a valid mala count (max 10,000 per entry).'
            );
            expect(runTransaction).not.toHaveBeenCalled();
        });
    });

    describe('submitJapaEntry offline fallback', () => {
        it('queues the entry locally when the primary transaction fails with a fallback-worthy error', async () => {
            vi.mocked(runTransaction).mockRejectedValueOnce(new Error('FIREBASE_TIMEOUT'));
            const queueSpy = vi.spyOn(localStore, 'queueJapaEntry').mockImplementation(() => {});

            const entry: JapaEntry = {
                id: 'e2', communityId: 'c1', userId: 'u1', malas: 1, mantras: 108
            } as JapaEntry;

            await communityJapaService.submitJapaEntry('c1', entry);

            expect(queueSpy).toHaveBeenCalledWith(entry);
        });
    });

    describe('communityJapaApi.submitJapaEntry (transaction body)', () => {
        it('is idempotent: does not re-apply increments when the entry doc already exists', async () => {
            const transactionGet = vi.fn().mockResolvedValue({ exists: () => true });
            const transactionSet = vi.fn();
            const transactionUpdate = vi.fn();

            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: transactionGet,
                    set: transactionSet,
                    update: transactionUpdate,
                } as any);
            });

            const entry: JapaEntry = {
                id: 'existing-entry', communityId: 'c1', userId: 'u1', malas: 1, mantras: 108
            } as JapaEntry;

            await communityJapaApi.submitJapaEntry('c1', entry);

            // Only the entry-existence read should occur; no writes for an already-processed entry.
            expect(transactionSet).not.toHaveBeenCalled();
            expect(transactionUpdate).not.toHaveBeenCalled();
        });

        it('creates a new user stats doc via set+merge when the user doc does not exist yet', async () => {
            const snapshots: Record<string, { exists: () => boolean; data?: () => any }> = {
                entry: { exists: () => false },
                user: { exists: () => false },
                community: { exists: () => false },
                member: { exists: () => false },
            };

            let callIndex = 0;
            const order = ['entry', 'user', 'community', 'member'];
            const transactionGet = vi.fn().mockImplementation(() => {
                const key = order[callIndex++];
                return Promise.resolve(snapshots[key]);
            });
            const transactionSet = vi.fn();
            const transactionUpdate = vi.fn();

            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: transactionGet,
                    set: transactionSet,
                    update: transactionUpdate,
                } as any);
            });

            const entry: JapaEntry = {
                id: 'new-entry', communityId: 'c1', userId: 'new-user', malas: 2, mantras: 216
            } as JapaEntry;

            await communityJapaApi.submitJapaEntry('c1', entry);

            // The entry itself is always written.
            expect(transactionSet).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ malas: 2, mantras: 216 })
            );
            // New user: set+merge with a fresh streak of 1, not transaction.update (would NOT_FOUND).
            expect(transactionSet).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    uid: 'new-user',
                    stats: expect.objectContaining({ streakDays: 1, totalMalas: 2, totalMantras: 216 })
                }),
                { merge: true }
            );
            expect(transactionUpdate).not.toHaveBeenCalled();
        });

        it('increments existing user stats via transaction.update when the user doc exists', async () => {
            const order = ['entry', 'user', 'community', 'member'];
            let callIndex = 0;
            const snapshots: Record<string, any> = {
                entry: { exists: () => false },
                user: {
                    exists: () => true,
                    data: () => ({ stats: { streakDays: 3, lastChantDate: '2020-01-01', totalMalas: 10, totalMantras: 1080 } })
                },
                community: { exists: () => false },
                member: { exists: () => false },
            };
            const transactionGet = vi.fn().mockImplementation(() => Promise.resolve(snapshots[order[callIndex++]]));
            const transactionSet = vi.fn();
            const transactionUpdate = vi.fn();

            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: transactionGet,
                    set: transactionSet,
                    update: transactionUpdate,
                } as any);
            });

            const entry: JapaEntry = {
                id: 'entry-3', communityId: 'c1', userId: 'existing-user', malas: 1, mantras: 108
            } as JapaEntry;

            await communityJapaApi.submitJapaEntry('c1', entry);

            expect(transactionUpdate).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ 'stats.totalMalas': 1, 'stats.totalMantras': 108, 'stats.streakDays': 1 })
            );
        });
    });
});
