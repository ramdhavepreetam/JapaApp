import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
    };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

describe('storage.SessionState', () => {
    beforeEach(() => localStorageMock.clear());

    it('get() returns active:false on empty storage', () => {
        const data = storage.get();
        expect(data.session.active).toBe(false);
    });

    it('get() does not have a paused field', () => {
        const data = storage.get();
        expect('paused' in data.session).toBe(false);
    });

    it('get() silently ignores stale paused:true from localStorage', () => {
        localStorageMock.setItem('japa_storage_v1', JSON.stringify({
            session: { active: true, paused: true, counts: 5, malas: 0, startedAt: null, updatedAt: null }
        }));
        const data = storage.get();
        expect('paused' in data.session).toBe(false);
        expect(data.session.active).toBe(true);
    });

    it('startSession() makes session active', () => {
        const data = storage.startSession();
        expect(data.session.active).toBe(true);
    });

    it('increment() counts when session active', () => {
        storage.startSession();
        const { newData } = storage.increment();
        expect(newData.session.counts).toBe(1);
    });

    it('resetSession() clears session', () => {
        storage.startSession();
        storage.increment();
        const data = storage.resetSession();
        expect(data.session.active).toBe(false);
        expect(data.session.counts).toBe(0);
    });

    it('storage has no pauseSession method', () => {
        expect('pauseSession' in storage).toBe(false);
    });

    it('storage has no resumeSession method', () => {
        expect('resumeSession' in storage).toBe(false);
    });
});
