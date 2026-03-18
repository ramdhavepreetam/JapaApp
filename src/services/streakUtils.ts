import { UserStats, StreakData } from '../types/profile';
import { getTodayDate } from '../lib/storage';

// Returns local YYYY-MM-DD for yesterday using the same calendar as getTodayDate()
const getYesterdayDate = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function calculateStreak(lastChantDate: string | null, currentStreak: number): number {
  if (!lastChantDate) return 1;

  const todayStr = getTodayDate();
  if (lastChantDate === todayStr) {
    return currentStreak;
  }

  const yesterdayStr = getYesterdayDate();
  if (lastChantDate === yesterdayStr) {
    return currentStreak + 1;
  }

  return 1;
}

export function isChantedToday(lastChantDate: string | null): boolean {
  if (!lastChantDate) return false;
  return lastChantDate === getTodayDate();
}

export function buildStreakData(stats: UserStats): StreakData {
  return {
    currentStreak: stats.streakDays,
    longestStreak: stats.longestStreak || stats.streakDays, // Fallback if undefined
    lastChantDate: stats.lastChantDate,
    isChantedToday: isChantedToday(stats.lastChantDate)
  };
}
