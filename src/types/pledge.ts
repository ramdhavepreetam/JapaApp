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
