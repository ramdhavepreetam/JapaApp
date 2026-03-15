import { Timestamp } from 'firebase/firestore';
import { UserRole } from './auth';

export type AdminAction =
  | 'BAN_USER'
  | 'UNBAN_USER'
  | 'DELETE_COMMUNITY'
  | 'FEATURE_COMMUNITY'
  | 'UNFEATURE_COMMUNITY'
  | 'ASSIGN_ROLE'
  | 'DELETE_PLEDGE';

export interface AdminLog {
  logId: string;
  action: AdminAction;
  targetId: string;
  adminId: string;
  reason: string;
  createdAt: Timestamp;
}

export interface AdminUserView {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: 'active' | 'banned' | 'suspended';
  plan: 'free' | 'pro' | 'community';
  stats: {
    totalMalas: number;
    totalMantras: number;
    streakDays: number;
    lastChantDate: string | null;
  };
  joinedAt: Timestamp;
}

export interface AdminCommunityView {
  communityId: string;
  name: string;
  isPublic: boolean;
  featured: boolean;
  memberCount: number;
  createdBy: string;
  createdAt: Timestamp;
}
