import { createTheme, Theme } from '@mui/material/styles';

const sharedTypography = {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h2: { fontFamily: '"Playfair Display", serif', fontWeight: 700 },
    h3: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h4: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h5: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    h6: { fontFamily: '"Playfair Display", serif', fontWeight: 600 },
    subtitle1: { fontFamily: '"Playfair Display", serif', fontStyle: 'italic' as const },
    button: { fontFamily: '"Playfair Display", serif', fontWeight: 700, letterSpacing: '0.05em' },
};

const sharedShape = { borderRadius: 16 };

export const defaultTheme = createTheme({
    palette: {
        primary: {
            main: '#EA580C',
            light: '#F97316',
            dark: '#C2410C',
            contrastText: '#FFF8F0',
        },
        secondary: {
            main: '#881337',
            light: '#9F1239',
            dark: '#4C0519',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#FFF8F0',
            paper: '#FFFFFF',
        },
        text: {
            primary: '#451A1A',
            secondary: '#78350F',
        },
        warning: { main: '#F59E0B' },
    },
    typography: sharedTypography,
    shape: sharedShape,
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: 'none', padding: '12px 24px' },
                containedPrimary: {
                    boxShadow: '0 4px 14px 0 rgba(234, 88, 12, 0.39)',
                    '&:hover': { boxShadow: '0 6px 20px rgba(234, 88, 12, 0.23)' },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    border: '1px solid rgba(234, 88, 12, 0.1)',
                },
            },
        },
    },
});

// Backward-compat export used by imports that have `import { theme } from './theme'`
export const theme = defaultTheme;

export const tapasviTheme = createTheme({
    palette: {
        primary: {
            main: '#B45309',
            light: '#D97706',
            dark: '#92400E',
            contrastText: '#FFFBEB',
        },
        secondary: {
            main: '#78350F',
            light: '#92400E',
            dark: '#451A03',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#FFFBEB',
            paper: '#FEF3C7',
        },
        text: {
            primary: '#451A03',
            secondary: '#78350F',
        },
        warning: { main: '#D97706' },
    },
    typography: sharedTypography,
    shape: sharedShape,
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: 'none', padding: '12px 24px' },
                containedPrimary: {
                    boxShadow: '0 4px 14px 0 rgba(180, 83, 9, 0.4)',
                    '&:hover': { boxShadow: '0 6px 20px rgba(180, 83, 9, 0.25)' },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.08)',
                    border: '1px solid rgba(180, 83, 9, 0.15)',
                },
            },
        },
    },
});

export const japaSiddhaTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#C0A060',
            light: '#D4B87A',
            dark: '#A08040',
            contrastText: '#0F172A',
        },
        secondary: {
            main: '#7DD3FC',
            light: '#BAE6FD',
            dark: '#0284C7',
            contrastText: '#0F172A',
        },
        background: {
            default: '#0F172A',
            paper: '#1E293B',
        },
        text: {
            primary: '#E2E8F0',
            secondary: '#C0A060',
        },
        warning: { main: '#C0A060' },
    },
    typography: sharedTypography,
    shape: sharedShape,
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: 'none', padding: '12px 24px' },
                containedPrimary: {
                    boxShadow: '0 4px 14px 0 rgba(192, 160, 96, 0.4)',
                    '&:hover': { boxShadow: '0 6px 20px rgba(192, 160, 96, 0.25)' },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(192, 160, 96, 0.2)',
                },
            },
        },
    },
});

export const mahaSiddhaTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#A78BFA',
            light: '#C4B5FD',
            dark: '#7C3AED',
            contrastText: '#0F0A1E',
        },
        secondary: {
            main: '#F0E6D3',
            light: '#FDF4FF',
            dark: '#C4A882',
            contrastText: '#0F0A1E',
        },
        background: {
            default: '#0F0A1E',
            paper: '#1E1535',
        },
        text: {
            primary: '#F0E6D3',
            secondary: '#A78BFA',
        },
        warning: { main: '#F0E6D3' },
    },
    typography: sharedTypography,
    shape: sharedShape,
    components: {
        MuiButton: {
            styleOverrides: {
                root: { textTransform: 'none', padding: '12px 24px' },
                containedPrimary: {
                    boxShadow: '0 4px 14px 0 rgba(167, 139, 250, 0.4)',
                    '&:hover': { boxShadow: '0 6px 20px rgba(167, 139, 250, 0.25)' },
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)',
                    border: '1px solid rgba(167, 139, 250, 0.2)',
                },
            },
        },
    },
});

export function getThemeForRank(key: 'default' | 'tapasvi' | 'japa_siddha' | 'maha_siddha'): Theme {
    switch (key) {
        case 'tapasvi': return tapasviTheme;
        case 'japa_siddha': return japaSiddhaTheme;
        case 'maha_siddha': return mahaSiddhaTheme;
        default: return defaultTheme;
    }
}
