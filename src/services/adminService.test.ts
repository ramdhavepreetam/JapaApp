import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from './adminService';
import { writeBatch } from 'firebase/firestore';

// Mock Firebase
vi.mock('../lib/firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'superadmin_123' }
  }
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, path, id) => ({ id: id || 'mock_doc_id', path, type: 'document' })),
  writeBatch: vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined)
  })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  where: vi.fn(),
  getCountFromServer: vi.fn()
}));

describe('adminService', () => {
  let mockBatch: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBatch = {
      set: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      commit: vi.fn().mockResolvedValue(undefined)
    };
    (writeBatch as any).mockReturnValue(mockBatch);
  });

  describe('writeAdminLog', () => {
    it('writes a log entry with the correct action and reason', async () => {
      await adminService.writeAdminLog('DELETE_PLEDGE', 'pledge_1', 'Inappropriate content');
      
      expect(mockBatch.set).toHaveBeenCalledTimes(1);
      expect(mockBatch.set.mock.calls[0][1]).toMatchObject({
        action: 'DELETE_PLEDGE',
        targetId: 'pledge_1',
        adminId: 'superadmin_123',
        reason: 'Inappropriate content'
      });
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  describe('banUser', () => {
    it('updates user status to banned and writes an audit log', async () => {
      await adminService.banUser('target_user_uid', 'Spamming other users');

      // Check update
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        { status: 'banned' }
      );
      
      // Check audit log
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'BAN_USER',
          targetId: 'target_user_uid',
          reason: 'Spamming other users'
        })
      );
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('throws error if reason is empty', async () => {
      await expect(adminService.banUser('uid', '  ')).rejects.toThrow('Ban reason is required');
    });
  });

  describe('featureCommunity', () => {
    it('updates community featured flag and writes an audit log', async () => {
      await adminService.featureCommunity('comm_1');

      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        { featured: true }
      );
      
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'FEATURE_COMMUNITY',
          targetId: 'comm_1'
        })
      );
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });
});
