export interface UserStats {
  totalMalas: number;
  totalMantras: number;
  streakDays: number;
  lastChantDate: string | null;
  longestStreak: number;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastChantDate: string | null;
  isChantedToday: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  stats: UserStats;
  joinedAt: Date;
}
