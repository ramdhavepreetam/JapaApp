export type SessionStatus = 'idle' | 'active' | 'paused' | 'completed';

export interface BeadState {
  currentBead: number;
  totalBeads: 108;
  completedMalas: number;
}

export interface CounterSession {
  sessionId: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  status: SessionStatus;
  completedMalas: number;
  totalBeads: number;
  communityId?: string;
  pledgeId?: string;
}

export interface CounterSettings {
  hapticEnabled: boolean;
  soundEnabled: boolean;
  targetMalas: number;
}

export const BEADS_PER_MALA = 108;
