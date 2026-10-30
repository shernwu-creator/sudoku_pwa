/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          "'Segoe UI'",
          "'PingFang TC'",
          "'Noto Sans TC'",
          "'Microsoft JhengHei'",
          'system-ui',
          'sans-serif',
        ],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      boxShadow: {
        board: '0 1px 2px rgba(15, 23, 42, 0.06), 0 24px 48px -32px rgba(49, 46, 129, 0.55)',
        card: '0 1px 2px rgba(15, 23, 42, 0.06), 0 12px 24px -18px rgba(15, 23, 42, 0.35)',
      },
      keyframes: {
        'cell-pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0.35' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-3px)' },
          '40%': { transform: 'translateX(3px)' },
          '60%': { transform: 'translateX(-2px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'dialog-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'cell-pop': 'cell-pop 0.16s ease-out',
        shake: 'shake 0.3s ease-in-out',
        'fade-in': 'fade-in 0.25s ease-out',
        'dialog-in': 'dialog-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
