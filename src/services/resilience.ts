export const shouldFallback = (error: any): boolean => {
    if (!error) return false;
    const msg = error.message || '';
    const code = error.code || '';

    return (
        msg === "FIREBASE_TIMEOUT" ||
        msg.includes("offline") ||
        code === 'unavailable' ||
        code === 'permission-denied' || // Often happens on auth weirdness/offline
        code === 'deadline-exceeded'
    );
};

export const withTimeout = <T>(promise: Promise<T>, ms: number = 5000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("FIREBASE_TIMEOUT")), ms)
        )
    ]);
};

let USE_MOCK_FALLBACK = false;

export const resetFallbackState = () => {
    USE_MOCK_FALLBACK = false;
};

export const isFallbackMode = () => USE_MOCK_FALLBACK;

// Reset sticky fallback flag whenever the device reconnects so the next
// Firestore call gets a real attempt instead of going straight to localStorage.
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        USE_MOCK_FALLBACK = false;
    });
}

export const runWithFallback = async <T>(
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    contextString: string
): Promise<T> => {
    // If we already decided the backend is unreachable, skip straight to mock
    if (USE_MOCK_FALLBACK) {
        console.log(`[Offline/Demo] ${contextString}`);
        return fallbackFn();
    }

    try {
        // Try the primary function with a timeout
        return await withTimeout(primaryFn(), 5000);
    } catch (error: any) {
        if (shouldFallback(error)) {
            console.warn(`Backend failed (${contextString}) - Switching to Offline Mode:`, error);
            USE_MOCK_FALLBACK = true;
            return fallbackFn();
        }
        // If it's a validation error or something else, rethrow
        throw error;
    }
};
