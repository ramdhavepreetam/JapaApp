import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isIOSLike, triggerHaptic } from './haptics';

type NavigatorOverrides = {
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
    vibrate?: ((pattern: number | number[]) => boolean) | undefined;
};

const setNavigatorOverrides = ({
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    platform = 'MacIntel',
    maxTouchPoints = 0,
    vibrate,
}: NavigatorOverrides) => {
    Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        get: () => userAgent,
    });
    Object.defineProperty(navigator, 'platform', {
        configurable: true,
        get: () => platform,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
        configurable: true,
        get: () => maxTouchPoints,
    });
    Object.defineProperty(navigator, 'vibrate', {
        configurable: true,
        value: vibrate,
    });
};

describe('haptics', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('uses navigator.vibrate on non-iOS browsers', () => {
        const vibrate = vi.fn(() => true);
        setNavigatorOverrides({
            userAgent: 'Mozilla/5.0 (Linux; Android 14)',
            platform: 'Linux armv8l',
            maxTouchPoints: 5,
            vibrate,
        });

        expect(isIOSLike()).toBe(false);
        expect(triggerHaptic([100, 50, 100])).toBe(true);
        expect(vibrate).toHaveBeenCalledWith([100, 50, 100]);
        expect(document.getElementById('japa-ios-haptic-switch')).toBeNull();
    });

    it('creates and toggles a Safari switch control on iOS', () => {
        setNavigatorOverrides({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)',
            platform: 'iPhone',
            maxTouchPoints: 5,
            vibrate: undefined,
        });

        expect(isIOSLike()).toBe(true);
        expect(triggerHaptic(15)).toBe(true);

        const input = document.getElementById('japa-ios-haptic-switch');
        expect(input).toBeInstanceOf(HTMLInputElement);
        expect(input).toHaveAttribute('switch');
        expect((input as HTMLInputElement).checked).toBe(true);
    });

    it('reuses the same iOS switch trigger between taps', () => {
        setNavigatorOverrides({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X)',
            platform: 'iPhone',
            maxTouchPoints: 5,
            vibrate: undefined,
        });

        expect(triggerHaptic(15)).toBe(true);
        expect(triggerHaptic(15)).toBe(true);

        expect(document.querySelectorAll('#japa-ios-haptic-container')).toHaveLength(1);
        expect(document.querySelectorAll('#japa-ios-haptic-switch')).toHaveLength(1);
    });
});
