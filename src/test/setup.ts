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
        doc: vi.fn(),
        getDocs: vi.fn(),
        query: vi.fn(),
        where: vi.fn(),
        increment: vi.fn((n) => n),
        writeBatch: vi.fn(() => ({
            set: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            commit: vi.fn().mockResolvedValue(undefined),
        })),
        Timestamp: {
            now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
        },
        addDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
        updateDoc: vi.fn(),
    };
});

vi.mock('../lib/firebase', () => ({
    db: {},
    auth: {
        currentUser: null
    }
}));

afterEach(() => {
    vi.clearAllMocks();
});
