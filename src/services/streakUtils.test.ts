import { describe, it, expect } from 'vitest';
import { calculateStreak, isChantedToday, buildStreakData } from './streakUtils';
import { UserStats } from '../types/profile';

describe('streakUtils', () => {

    describe('calculateStreak', () => {

        it('should return current streak when lastChantDate is today', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            expect(calculateStreak(todayStr, 5)).toBe(5);
        });

        it('should increment streak when lastChantDate is yesterday', () => {
            const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            expect(calculateStreak(yesterdayStr, 5)).toBe(6);
        });

        it('should reset streak to 1 when lastChantDate is older than yesterday', () => {
            const olderDateStr = new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];
            expect(calculateStreak(olderDateStr, 5)).toBe(1);
        });

        it('should return 1 when lastChantDate is null', () => {
            expect(calculateStreak(null, 0)).toBe(1);
        });
    });

    describe('isChantedToday', () => {
        it('should return true if lastChantDate is today', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            expect(isChantedToday(todayStr)).toBe(true);
        });

        it('should return false if lastChantDate is yesterday', () => {
             const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
             expect(isChantedToday(yesterdayStr)).toBe(false);
        });

        it('should return false if lastChantDate is null', () => {
             expect(isChantedToday(null)).toBe(false);
        });
    });

    describe('buildStreakData', () => {
        it('should build correct StreakData from UserStats', () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const stats: UserStats = {
                totalMalas: 10,
                totalMantras: 1080,
                streakDays: 5,
                longestStreak: 10,
                lastChantDate: todayStr
            };
            
            const streakData = buildStreakData(stats);
            
            expect(streakData.currentStreak).toBe(5);
            expect(streakData.longestStreak).toBe(10);
            expect(streakData.lastChantDate).toBe(todayStr);
            expect(streakData.isChantedToday).toBe(true);
        });
    });
});
