import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runTransaction, writeBatch, getCountFromServer, getDocs } from 'firebase/firestore';
import { communityService } from './communityService';
import { localStore } from './localStore';
import { resetFallbackState } from './resilience';
import { UserProfileSummary } from '../types/community';

describe('communityService', () => {
    const creator: UserProfileSummary = { uid: 'creator-1', displayName: 'Creator', photoURL: '' };

    beforeEach(() => {
        vi.clearAllMocks();
        resetFallbackState();
    });

    describe('createCommunity', () => {
        it('requires an authenticated creator', async () => {
            await expect(
                communityService.createCommunity({
                    name: 'Test', description: '', isPrivate: false, requiresApproval: false,
                    creator: { uid: '' } as UserProfileSummary
                })
            ).rejects.toThrow('Requires authentication');
        });

        it('rejects creation once the user already owns 3 communities', async () => {
            vi.mocked(getCountFromServer).mockResolvedValueOnce({ data: () => ({ count: 3 }) } as any);

            await expect(
                communityService.createCommunity({
                    name: 'Fourth Community', description: '', isPrivate: false,
                    requiresApproval: false, creator
                })
            ).rejects.toThrow('You can create up to 3 communities');

            expect(writeBatch).not.toHaveBeenCalled();
        });

        it('rejects creation when the community name is already taken', async () => {
            vi.mocked(getCountFromServer).mockResolvedValueOnce({ data: () => ({ count: 0 }) } as any);
            vi.mocked(getDocs).mockResolvedValueOnce({ empty: false, docs: [] } as any);

            await expect(
                communityService.createCommunity({
                    name: 'Existing Name', description: '', isPrivate: false,
                    requiresApproval: false, creator
                })
            ).rejects.toThrow('A community with this name already exists');

            expect(writeBatch).not.toHaveBeenCalled();
        });

        it('creates the community and adds the creator as owner via a single batch commit', async () => {
            vi.mocked(getCountFromServer).mockResolvedValueOnce({ data: () => ({ count: 0 }) } as any);
            vi.mocked(getDocs).mockResolvedValueOnce({ empty: true, docs: [] } as any);

            const id = await communityService.createCommunity({
                name: 'New Community', description: 'desc', isPrivate: false,
                requiresApproval: false, creator
            });

            expect(id).toBe('mock-doc-id');
            const batchMock = vi.mocked(writeBatch).mock.results[0].value;
            expect(batchMock.set).toHaveBeenCalledTimes(2); // community doc + member doc
            expect(batchMock.set).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ role: 'owner', status: 'active' })
            );
            expect(batchMock.commit).toHaveBeenCalled();
        });
    });

    describe('joinCommunityOpen (transaction-based, race-safe)', () => {
        it('rejects joining a community that requires approval', async () => {
            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ requiresApproval: true }) }),
                } as any);
            });

            await expect(
                communityService.joinCommunityOpen('c1', creator)
            ).rejects.toThrow('This community requires approval to join.');
        });

        it('rejects joining when the user is banned', async () => {
            let callIndex = 0;
            const responses = [
                { exists: () => true, data: () => ({ requiresApproval: false }) }, // community
                { exists: () => true, data: () => ({ status: 'banned' }) },        // member
            ];
            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: vi.fn().mockImplementation(() => Promise.resolve(responses[callIndex++])),
                } as any);
            });

            await expect(
                communityService.joinCommunityOpen('c1', creator)
            ).rejects.toThrow('You are banned from this community.');
        });

        it('is idempotent when the user is already an active member (no duplicate increment)', async () => {
            let callIndex = 0;
            const responses = [
                { exists: () => true, data: () => ({ requiresApproval: false }) },
                { exists: () => true, data: () => ({ status: 'active' }) },
            ];
            const transactionSet = vi.fn();
            const transactionUpdate = vi.fn();
            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: vi.fn().mockImplementation(() => Promise.resolve(responses[callIndex++])),
                    set: transactionSet,
                    update: transactionUpdate,
                } as any);
            });

            await communityService.joinCommunityOpen('c1', creator);

            expect(transactionSet).not.toHaveBeenCalled();
            expect(transactionUpdate).not.toHaveBeenCalled();
        });

        it('adds the member and increments membersCount exactly once for a fresh join', async () => {
            let callIndex = 0;
            const responses = [
                { exists: () => true, data: () => ({ requiresApproval: false }) },
                { exists: () => false },
            ];
            const transactionSet = vi.fn();
            const transactionUpdate = vi.fn();
            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: vi.fn().mockImplementation(() => Promise.resolve(responses[callIndex++])),
                    set: transactionSet,
                    update: transactionUpdate,
                } as any);
            });

            await communityService.joinCommunityOpen('c1', creator);

            expect(transactionSet).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ uid: creator.uid, role: 'member', status: 'active' })
            );
            expect(transactionUpdate).toHaveBeenCalledTimes(1);
            expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), { membersCount: 1 });
        });

        it('falls back to local join when the transaction path is unreachable', async () => {
            vi.mocked(runTransaction).mockRejectedValueOnce(new Error('FIREBASE_TIMEOUT'));
            vi.spyOn(localStore, 'getCommunity').mockReturnValueOnce({ id: 'c1' } as any);
            const joinSpy = vi.spyOn(localStore, 'joinCommunity').mockImplementation(() => {});

            await communityService.joinCommunityOpen('c1', creator);

            expect(joinSpy).toHaveBeenCalledWith(expect.objectContaining({ uid: creator.uid, communityId: 'c1' }));
        });
    });

    describe('leaveCommunity (transaction-based, race-safe)', () => {
        it('is idempotent when the member has already left or was never active', async () => {
            const transactionUpdate = vi.fn();
            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ status: 'left' }) }),
                    update: transactionUpdate,
                } as any);
            });

            await communityService.leaveCommunity('c1', 'u1');

            expect(transactionUpdate).not.toHaveBeenCalled();
        });

        it('marks the member left and decrements membersCount exactly once', async () => {
            const transactionUpdate = vi.fn();
            vi.mocked(runTransaction).mockImplementationOnce(async (_db, updateFn) => {
                return updateFn({
                    get: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ status: 'active' }) }),
                    update: transactionUpdate,
                } as any);
            });

            await communityService.leaveCommunity('c1', 'u1');

            expect(transactionUpdate).toHaveBeenCalledTimes(2);
            expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), { status: 'left' });
            expect(transactionUpdate).toHaveBeenCalledWith(expect.anything(), { membersCount: -1 });
        });
    });
});
