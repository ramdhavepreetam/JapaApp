import '@testing-library/jest-dom';
import { vi, beforeAll, afterEach } from 'vitest';

// Global mocks
beforeAll(() => {
  // Mock navigator.onLine since we are testing sync behavior
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => true, // default to online, override in specific tests if needed
  });
});

// Mock firebase
vi.mock('firebase/firestore', async () => {
    return {
        collection: vi.fn(),
        doc: vi.fn(() => ({ id: 'mock-doc-id' })),
        getDoc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        orderBy: vi.fn(),
        limit: vi.fn(),
        startAfter: vi.fn(),
        getCountFromServer: vi.fn(),
        increment: vi.fn((n) => n),
        serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
        setDoc: vi.fn().mockResolvedValue(undefined),
        writeBatch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined),
        })),
        runTransaction: vi.fn(),
        Timestamp: {
            now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
            fromDate: vi.fn((date: Date) => {
                const seconds = Math.floor(date.getTime() / 1000);
                const nanoseconds = (date.getTime() % 1000) * 1000000;
                return {
                    seconds,
                    nanoseconds,
                    toDate: () => date
                };
            }),
        },
        addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
        updateDoc: vi.fn(),
    };
});

vi.mock('../lib/firebase', () => ({
    db: {},
    auth: {
        currentUser: null
    },
    analytics: null
}));

afterEach(() => {
    vi.clearAllMocks();
});
