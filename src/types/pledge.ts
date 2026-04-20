import type { Timestamp } from 'firebase/firestore';

export interface Pledge {
  id: string;
  title: string;
  description: string;
  targetMalas: number;
  currentMalas: number;
  participants: number;
  creatorId?: string;
  mantra?: string;
  communityId?: string;  // Optional — undefined means global/legacy pledge
  createdAt?: Timestamp; // Set at write time; used for admin sorting
  isPublic?: boolean;    // If true, guests can contribute via QR code without joining
}

export interface PersonalPledge {
  id: string;
  title: string;
  description?: string;
  targetMalas: number;
  currentMalas: number;
  mantra?: string;
  createdAt: Timestamp;
}

export interface PledgeParticipant {
  id: string;
  pledgeId: string;
  userId: string;
  contributedMalas: number;
  joinedAt: Timestamp;
  userDisplayName: string;
  pledgeTitle: string;
  pledgeTarget: number;
}
