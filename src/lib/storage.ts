export type DayStats = {
    date: string;
    counts: number;
    malas: number;
};

export type StorageSchema = {
    history: Record<string, DayStats>;
    currentCount: number;
    currentMala: number;
    totalCounts: number;
    session: SessionState;
    pendingSync: PendingSyncItem[];
};

const STORAGE_KEY = 'japa_storage_v1';

export type SessionState = {
    active: boolean;
    paused: boolean;
    startedAt: string | null;
    updatedAt: string | null;
    counts: number;
    malas: number;
};

export type PendingSyncItem = {
    id: string;
    createdAt: string;
    counts: number;
    malas: number;
    completed: boolean;
};

const getTodayDate = () => new Date().toISOString().split('T')[0];

const INITIAL_STATE: StorageSchema = {
    history: {},
    currentCount: 0,
    currentMala: 0,
    totalCounts: 0,
    session: {
        active: false,
        paused: false,
        startedAt: null,
        updatedAt: null,
        counts: 0,
        malas: 0,
    },
    pendingSync: [],
};

export const storage = {
    get: (): StorageSchema => {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (!data) return INITIAL_STATE;
            const parsed = JSON.parse(data);
            return {
                ...INITIAL_STATE,
                ...parsed,
                session: { ...INITIAL_STATE.session, ...(parsed.session || {}) },
                pendingSync: Array.isArray(parsed.pendingSync) ? parsed.pendingSync : []
            };
        } catch (e) {
            console.error('Failed to parse storage', e);
            return INITIAL_STATE;
        }
    },

    save: (data: StorageSchema) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Failed to save persistence', e);
        }
    },

    increment: () => {
        const data = storage.get();
        const today = getTodayDate();

        // Update daily stats
        if (!data.history[today]) {
            data.history[today] = { date: today, counts: 0, malas: 0 };
        }

        data.currentCount += 1;
        data.history[today].counts += 1;
        data.totalCounts += 1;
        if (data.session.active && !data.session.paused) {
            data.session.counts += 1;
            data.session.updatedAt = new Date().toISOString();
        }

        let malaCompleted = false;
        // Check for Mala completion (108)
        if (data.currentCount >= 108) {
            data.currentCount = 0;
            data.currentMala += 1;
            data.history[today].malas += 1;
            malaCompleted = true;
            if (data.session.active && !data.session.paused) {
                data.session.malas += 1;
                data.session.updatedAt = new Date().toISOString();
            }
        }

        storage.save(data);
        return { newData: data, malaCompleted };
    },

    resetToday: () => {
        const data = storage.get();
        const today = getTodayDate();
        data.currentCount = 0;
        data.currentMala = 0;
        if (data.history[today]) {
            data.history[today].counts = 0;
            data.history[today].malas = 0;
        }
        storage.save(data);
        return data;
    },

    startSession: () => {
        const data = storage.get();
        const now = new Date().toISOString();
        data.session.active = true;
        data.session.paused = false;
        data.session.startedAt = data.session.startedAt || now;
        data.session.updatedAt = now;
        storage.save(data);
        return data;
    },

    pauseSession: () => {
        const data = storage.get();
        if (!data.session.active) return data;
        data.session.paused = true;
        data.session.updatedAt = new Date().toISOString();
        storage.save(data);
        return data;
    },

    resumeSession: () => {
        const data = storage.get();
        if (!data.session.active) return data;
        data.session.paused = false;
        data.session.updatedAt = new Date().toISOString();
        storage.save(data);
        return data;
    },

    resetSession: () => {
        const data = storage.get();
        data.session = {
            active: false,
            paused: false,
            startedAt: null,
            updatedAt: null,
            counts: 0,
            malas: 0,
        };
        storage.save(data);
        return data;
    },

    enqueueSync: (item: PendingSyncItem) => {
        const data = storage.get();
        data.pendingSync = [item, ...data.pendingSync].slice(0, 200);
        storage.save(data);
        return data;
    },

    dequeueSync: (id: string) => {
        const data = storage.get();
        data.pendingSync = data.pendingSync.filter(p => p.id !== id);
        storage.save(data);
        return data;
    },

    updateSessionUpdatedAt: () => {
        const data = storage.get();
        if (!data.session.active) return data;
        data.session.updatedAt = new Date().toISOString();
        storage.save(data);
        return data;
    }
};
