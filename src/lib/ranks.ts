export type RankId = 'nava_sadhaka' | 'sadhaka' | 'abhyasi' | 'tapasvi' | 'japa_siddha' | 'maha_siddha';

export interface Rank {
    id: RankId;
    thresholdJaps: number;
    titleEn: string;
    titleSanskrit: string;
    titleHi: string;
    themeKey: 'default' | 'tapasvi' | 'japa_siddha' | 'maha_siddha';
    beadFill: string;
    beadBackground: string;
    auraGlow: string;
    celebrationBg: string;
}

export const RANKS: Rank[] = [
    {
        id: 'nava_sadhaka',
        thresholdJaps: 0,
        titleEn: 'Nava Sadhaka',
        titleSanskrit: 'नव साधक',
        titleHi: 'नव साधक',
        themeKey: 'default',
        beadFill: '#fbbf24',
        beadBackground: '#4c0519',
        auraGlow: 'rgba(251,191,36,0.5)',
        celebrationBg: 'linear-gradient(160deg, #7c2d00 0%, #c2410c 50%, #ea580c 100%)',
    },
    {
        id: 'sadhaka',
        thresholdJaps: 1008,
        titleEn: 'Sadhaka',
        titleSanskrit: 'साधक',
        titleHi: 'साधक',
        themeKey: 'default',
        beadFill: '#fbbf24',
        beadBackground: '#4c0519',
        auraGlow: 'rgba(251,191,36,0.5)',
        celebrationBg: 'linear-gradient(160deg, #7c2d00 0%, #c2410c 50%, #ea580c 100%)',
    },
    {
        id: 'abhyasi',
        thresholdJaps: 10008,
        titleEn: 'Abhyasi',
        titleSanskrit: 'अभ्यासी',
        titleHi: 'अभ्यासी',
        themeKey: 'default',
        beadFill: '#fbbf24',
        beadBackground: '#4c0519',
        auraGlow: 'rgba(251,191,36,0.6)',
        celebrationBg: 'linear-gradient(160deg, #78350f 0%, #b45309 50%, #d97706 100%)',
    },
    {
        id: 'tapasvi',
        thresholdJaps: 125000,
        titleEn: 'Tapasvi',
        titleSanskrit: 'तपस्वी',
        titleHi: 'तपस्वी',
        themeKey: 'tapasvi',
        beadFill: '#d97706',
        beadBackground: '#292524',
        auraGlow: 'rgba(217,119,6,0.7)',
        celebrationBg: 'linear-gradient(160deg, #431407 0%, #7c2d12 50%, #b45309 100%)',
    },
    {
        id: 'japa_siddha',
        thresholdJaps: 1000000,
        titleEn: 'Japa Siddha',
        titleSanskrit: 'जप सिद्ध',
        titleHi: 'जप सिद्ध',
        themeKey: 'japa_siddha',
        beadFill: '#e2e8f0',
        beadBackground: '#1e3a5f',
        auraGlow: 'rgba(192,160,96,0.8)',
        celebrationBg: 'linear-gradient(160deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)',
    },
    {
        id: 'maha_siddha',
        thresholdJaps: 10000000,
        titleEn: 'Maha Siddha',
        titleSanskrit: 'महा सिद्ध',
        titleHi: 'महा सिद्ध',
        themeKey: 'maha_siddha',
        beadFill: '#f0e6d3',
        beadBackground: '#2d1b69',
        auraGlow: 'rgba(167,139,250,0.8)',
        celebrationBg: 'linear-gradient(160deg, #0f0a1e 0%, #2d1b69 50%, #4c1d95 100%)',
    },
];

export function getRankForJaps(totalCounts: number): Rank {
    let current = RANKS[0];
    for (const rank of RANKS) {
        if (totalCounts >= rank.thresholdJaps) {
            current = rank;
        } else {
            break;
        }
    }
    return current;
}

export function getCrossedMilestone(prev: number, next: number): Rank | null {
    for (const rank of RANKS) {
        if (rank.thresholdJaps === 0) continue;
        if (prev < rank.thresholdJaps && next >= rank.thresholdJaps) {
            return rank;
        }
    }
    return null;
}

const MILESTONE_SEEN_KEY = 'japa_milestone_seen';

export function isMilestoneSeen(rankId: RankId): boolean {
    try {
        const raw = localStorage.getItem(MILESTONE_SEEN_KEY);
        const seen: string[] = raw ? JSON.parse(raw) : [];
        return seen.includes(rankId);
    } catch {
        return false;
    }
}

export function markMilestoneSeen(rankId: RankId): void {
    try {
        const raw = localStorage.getItem(MILESTONE_SEEN_KEY);
        const seen: string[] = raw ? JSON.parse(raw) : [];
        if (!seen.includes(rankId)) {
            seen.push(rankId);
            localStorage.setItem(MILESTONE_SEEN_KEY, JSON.stringify(seen));
        }
    } catch {}
}
