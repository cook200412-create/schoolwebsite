import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' }, screens: { '2xl': '1200px' } },
    extend: {
      colors: {
        navy: { 50: '#eef3fb', 100: '#d9e4f5', 200: '#b3c9ea', 300: '#7fa3d6', 400: '#4a79bd', 500: '#2a5aa0', 600: '#1b4382', 700: '#12326a', 800: '#0c2552', 900: '#081a3b', 950: '#050f24' },
        sky: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7' },
        gold: { 50: '#fdf9ec', 100: '#faf0c9', 200: '#f4de8c', 300: '#ecc84f', 400: '#d9ad26', 500: '#b98f17', 600: '#8f6a10' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(8,26,59,.04), 0 8px 24px -8px rgba(8,26,59,.12)',
        lift: '0 2px 4px rgba(8,26,59,.06), 0 16px 36px -12px rgba(8,26,59,.22)',
      },
      borderRadius: { xl: '0.9rem', '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(14px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-up': 'fade-up .6s ease-out both' },
    },
  },
  plugins: [],
};
export default config;
