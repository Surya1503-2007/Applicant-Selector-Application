/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gov: {
          navy: '#0F172A',
          'navy-dark': '#090D16',
          'navy-light': '#1E293B',
          blue: '#1E3A8A',
          slate: '#334155',
          'slate-light': '#F8FAFC',
          border: '#E2E8F0',
          'border-dark': '#334155',
          gold: '#D97706',
          'gold-light': '#FEF3C7',
          'gold-dark': '#B45309',
        },
      },
    },
  },
  plugins: [],
};

