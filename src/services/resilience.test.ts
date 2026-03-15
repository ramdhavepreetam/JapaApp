import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runWithFallback, resetFallbackState, isFallbackMode, withTimeout, shouldFallback } from './resilience';

describe('resilience', () => {

    beforeEach(() => {
        resetFallbackState();
    });

    describe('shouldFallback', () => {
        it('should return true for network-related errors', () => {
            expect(shouldFallback({ message: 'FIREBASE_TIMEOUT' })).toBe(true);
            expect(shouldFallback({ message: 'offline error' })).toBe(true);
            expect(shouldFallback({ code: 'unavailable' })).toBe(true);
        });

        it('should return false for irrelevant errors', () => {
            expect(shouldFallback({ message: 'Validation Error' })).toBe(false);
            expect(shouldFallback(null)).toBe(false);
        });
    });

    describe('withTimeout', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should resolve if promise completes before timeout', async () => {
            const fastPromise = new Promise(resolve => setTimeout(() => resolve('success'), 100));
            const resultPromise = withTimeout(fastPromise, 5000);
            
            vi.advanceTimersByTime(150);
            await expect(resultPromise).resolves.toBe('success');
        });

        it('should reject with FIREBASE_TIMEOUT if promise takes too long', async () => {
            const slowPromise = new Promise(resolve => setTimeout(() => resolve('success'), 6000));
            const resultPromise = withTimeout(slowPromise, 5000);
            
            vi.advanceTimersByTime(5100);
            await expect(resultPromise).rejects.toThrow('FIREBASE_TIMEOUT');
        });
    });

    describe('runWithFallback', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return result from primaryFn on success', async () => {
            const primaryFn = vi.fn().mockResolvedValue('primary');
            const fallbackFn = vi.fn().mockResolvedValue('fallback');
            
            const result = await runWithFallback(primaryFn, fallbackFn, 'Test Context');
            
            expect(result).toBe('primary');
            expect(fallbackFn).not.toHaveBeenCalled();
            expect(isFallbackMode()).toBe(false);
        });

        it('should switch to fallbackFn on timeout and persist fallback mode', async () => {
             const primaryFn = vi.fn().mockImplementation(() => {
                return new Promise((resolve) => setTimeout(() => resolve('slow'), 6000));
            });
            const fallbackFn = vi.fn().mockResolvedValue('fallback');
            
            const runPromise = runWithFallback(primaryFn, fallbackFn, 'Test Context');
            
            // Advance past the 5000ms timeout
            vi.advanceTimersByTime(5100);
            
            const result = await runPromise;
            
            expect(result).toBe('fallback');
            expect(fallbackFn).toHaveBeenCalled();
            expect(isFallbackMode()).toBe(true); // Should now be in fallback mode

            // Subsequent calls should immediately use fallback
            const primaryFn2 = vi.fn().mockResolvedValue('primary2');
            const fallbackFn2 = vi.fn().mockResolvedValue('fallback2');
            
            const result2 = await runWithFallback(primaryFn2, fallbackFn2, 'Test Context 2');
            expect(result2).toBe('fallback2');
            expect(primaryFn2).not.toHaveBeenCalled();
        });
    });
});
