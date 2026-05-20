type HapticPattern = number | number[];

export const isIOSLike = (): boolean => {
    if (typeof navigator === 'undefined') return false;

    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const vibrateNatively = (pattern: HapticPattern): boolean => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return false;
    }

    try {
        return navigator.vibrate(pattern);
    } catch {
        return false;
    }
};

export const triggerHaptic = (pattern: HapticPattern = 15): boolean => {
    if (!isIOSLike()) {
        return vibrateNatively(pattern);
    }

    // On current iOS/Safari builds, synthetic clicks on a hidden switch no
    // longer reliably produce haptics. iOS haptics are handled by letting the
    // user's real tap hit an <input type="checkbox" switch> in the UI.
    return vibrateNatively(pattern);
};
