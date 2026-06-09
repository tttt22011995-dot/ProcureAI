/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        glass: {
          border: 'var(--glass-border)',
          highlight: 'var(--glass-highlight)',
        },
      },
      boxShadow: {
        glass: '0 12px 36px rgba(15,23,42,0.12)',
        'glass-hover': '0 8px 28px rgba(96,165,250,0.18)',
        'glass-hover-dark': '0 8px 28px rgba(34,211,238,0.14)',
      },
    },
  },
  plugins: [],
};
