import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    palette: {
        primary: {
            main: '#EA580C', // Saffron
            light: '#F97316',
            dark: '#C2410C',
            contrastText: '#FFF8F0',
        },
        secondary: {
            main: '#881337', // Maroon
            light: '#9F1239',
            dark: '#4C0519',
            contrastText: '#FFFFFF',
        },
        background: {
            default: '#FFF8F0', // Cream
            paper: '#FFFFFF',
        },
        text: {
            primary: '#451A1A', // Deep Maroon/Black
            secondary: '#78350F', // Saffron Brown
        },
        warning: {
            main: '#F59E0B', // Gold
        }
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
        },
        h2: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
        },
        h3: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 600,
        },
        h4: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 600,
        },
        h5: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 600,
        },
        h6: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 600,
        },
        subtitle1: {
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic',
        },
        button: {
            fontFamily: '"Playfair Display", serif',
            fontWeight: 700,
            letterSpacing: '0.05em',
        }
    },
    shape: {
        borderRadius: 16,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    padding: '12px 24px',
                },
                containedPrimary: {
                    boxShadow: '0 4px 14px 0 rgba(234, 88, 12, 0.39)',
                    '&:hover': {
                        boxShadow: '0 6px 20px rgba(234, 88, 12, 0.23)',
                    }
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                    border: '1px solid rgba(234, 88, 12, 0.1)',
                }
            }
        }
    },
});
