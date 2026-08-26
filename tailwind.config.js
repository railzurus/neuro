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
        canvas: '#fffaf6',
        surface: '#ffffff',
        ink: {
          900: '#241f38',
          700: '#453f5c',
          600: '#5b5578',
          500: '#78738f',
          400: '#9a95ab',
          300: '#bdb8c9',
        },
        // Оранжевый берётся ровно фирменный #ff6700 — он же на кнопках, в
        // градиентах и в ссылках. По контрасту с белым он даёт 2.9:1, то есть
        // ниже порога WCAG AA (4.5): мелкий текст этим цветом читается хуже,
        // чем прежняя бирюза. Если понадобится вернуть AA — на текст и заливки
        // под белыми подписями ставим brand.600 (#c85000, 4.6:1), оставив
        // #ff6700 крупным акцентам.
        brand: {
          DEFAULT: '#ff6700',
          600: '#c85000',
          50: '#fff1e8',
        },
        gold: '#cf9445',
        blob: {
          clay: '#ffd4b0',
          blush: '#ffe3cb',
          peach: '#ffdcbc',
          rose: '#ffc09a',
        },
      },
      boxShadow: {
        card: '0 14px 44px -20px rgba(122,52,8,0.26), 0 2px 8px -4px rgba(122,52,8,0.10)',
        soft: '0 8px 24px -12px rgba(122,52,8,0.20)',
        glow: '0 12px 34px -10px rgba(255,103,0,0.38)',
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
