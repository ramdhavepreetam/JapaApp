type HapticPattern = number | number[];

const IOS_HAPTIC_CONTAINER_ID = 'japa-ios-haptic-container';
const IOS_HAPTIC_SWITCH_ID = 'japa-ios-haptic-switch';
const IOS_HAPTIC_LABEL_ID = 'japa-ios-haptic-label';

type IOSHapticElements = {
    container: HTMLDivElement;
    input: HTMLInputElement;
    label: HTMLLabelElement;
};

let iosHapticElements: IOSHapticElements | null = null;

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

const getIOSHapticElements = (): IOSHapticElements | null => {
    if (typeof document === 'undefined' || !document.body) return null;

    if (iosHapticElements?.container.isConnected) {
        return iosHapticElements;
    }

    document.getElementById(IOS_HAPTIC_CONTAINER_ID)?.remove();

    const container = document.createElement('div');
    container.id = IOS_HAPTIC_CONTAINER_ID;
    container.setAttribute('aria-hidden', 'true');
    Object.assign(container.style, {
        position: 'fixed',
        right: '0',
        bottom: '0',
        width: '1px',
        height: '1px',
        opacity: '0.001',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: '2147483647',
    });

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = IOS_HAPTIC_SWITCH_ID;
    input.tabIndex = -1;
    input.setAttribute('switch', '');
    input.setAttribute('aria-hidden', 'true');
    Object.assign(input.style, {
        margin: '0',
    });

    const label = document.createElement('label');
    label.id = IOS_HAPTIC_LABEL_ID;
    label.htmlFor = IOS_HAPTIC_SWITCH_ID;
    label.textContent = 'Haptic feedback';
    Object.assign(label.style, {
        display: 'block',
        width: '44px',
        height: '28px',
    });

    container.append(input, label);
    document.body.appendChild(container);

    iosHapticElements = { container, input, label };
    return iosHapticElements;
};

const triggerIOSSwitchHaptic = (): boolean => {
    const elements = getIOSHapticElements();
    if (!elements) return false;

    const wasChecked = elements.input.checked;
    elements.label.click();

    if (elements.input.checked === wasChecked) {
        elements.input.click();
    }

    return elements.input.checked !== wasChecked;
};

export const triggerHaptic = (pattern: HapticPattern = 15): boolean => {
    if (!isIOSLike()) {
        return vibrateNatively(pattern);
    }

    const iosSwitchTriggered = triggerIOSSwitchHaptic();
    const nativeTriggered = vibrateNatively(pattern);

    return iosSwitchTriggered || nativeTriggered;
};
