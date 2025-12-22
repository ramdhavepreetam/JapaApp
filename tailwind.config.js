/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'saffron': {
                    DEFAULT: '#ea580c', // Dark orange/terracotta
                    500: '#f97316',
                    600: '#ea580c',
                    700: '#c2410c',
                },
                'maroon': {
                    DEFAULT: '#881337', // Deep red
                    800: '#9f1239',
                    900: '#881337',
                    950: '#4c0519',
                },
                'gold': {
                    DEFAULT: '#fbbf24',
                    400: '#fbbf24',
                    500: '#f59e0b',
                },
                'spiritual': {
                    900: '#2a0a10', // Very dark brownish red for BG
                    800: '#451a1a', // Lighter panel BG
                }
            },
            fontFamily: {
                serif: ['"Cinzel"', '"Merriweather"', 'serif'],
                sans: ['"Inter"', 'sans-serif'],
            },
            backgroundImage: {
                'mandala-pattern': "url('https://www.transparenttextures.com/patterns/black-scales.png')", // Subtle texture placeholder
            }
        },
    },
    plugins: [],
}
