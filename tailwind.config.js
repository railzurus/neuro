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
        canvas: '#f1f6f5',
        surface: '#ffffff',
        ink: {
          900: '#241f38',
          700: '#453f5c',
          600: '#5b5578',
          500: '#78738f',
          400: '#9a95ab',
          300: '#bdb8c9',
        },
        // Бирюза берётся глубокая, а не светлая: на кнопках по ней идёт белый
        // текст. #0f8480 даёт контраст 4.53 — выше порога WCAG AA (4.5) и чуть
        // лучше, чем было у прежнего кораллового (4.38). Светлая бирюза живёт
        // в blob-оттенках ниже: там она только фон и свечение.
        brand: {
          DEFAULT: '#0f8480',
          600: '#0b6a67',
          50: '#e3f2f1',
        },
        gold: '#cf9445',
        blob: {
          clay: '#bde4de',
          blush: '#cfe6ef',
          peach: '#d8efe6',
          rose: '#aedbd8',
        },
      },
      boxShadow: {
        card: '0 14px 44px -20px rgba(24,80,78,0.26), 0 2px 8px -4px rgba(24,80,78,0.10)',
        soft: '0 8px 24px -12px rgba(24,80,78,0.20)',
        glow: '0 12px 34px -10px rgba(15,132,128,0.45)',
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
