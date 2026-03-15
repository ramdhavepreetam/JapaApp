import { UserStats, StreakData } from '../types/profile';

export function calculateStreak(lastChantDate: string | null, currentStreak: number): number {
  if (!lastChantDate) return 1;

  const todayStr = new Date().toISOString().split('T')[0];
  if (lastChantDate === todayStr) {
    return currentStreak;
  }

  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (lastChantDate === yesterdayStr) {
    return currentStreak + 1;
  }

  return 1;
}

export function isChantedToday(lastChantDate: string | null): boolean {
  if (!lastChantDate) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return lastChantDate === todayStr;
}

export function buildStreakData(stats: UserStats): StreakData {
  return {
    currentStreak: stats.streakDays,
    longestStreak: stats.longestStreak || stats.streakDays, // Fallback if undefined
    lastChantDate: stats.lastChantDate,
    isChantedToday: isChantedToday(stats.lastChantDate)
  };
}
