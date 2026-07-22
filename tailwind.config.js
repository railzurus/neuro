/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f6f3f1',
        surface: '#ffffff',
        ink: {
          900: '#241f38',
          700: '#453f5c',
          600: '#5b5578',
          500: '#78738f',
          400: '#9a95ab',
          300: '#bdb8c9',
        },
        brand: {
          DEFAULT: '#c05b3a',
          600: '#a4482c',
          50: '#f8ece6',
        },
        gold: '#cf9445',
        blob: {
          clay: '#f0cbb5',
          blush: '#f6cdd8',
          peach: '#f7dcc3',
          rose: '#eec2b6',
        },
      },
      boxShadow: {
        card: '0 14px 44px -20px rgba(120,70,50,0.28), 0 2px 8px -4px rgba(120,70,50,0.10)',
        soft: '0 8px 24px -12px rgba(120,70,50,0.20)',
        glow: '0 12px 34px -10px rgba(192,91,58,0.55)',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        fadeup: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        breathe: 'breathe 8s ease-in-out infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        fadeup: 'fadeup 0.6s ease-out both',
      },
    },
  },
  plugins: [],
}
