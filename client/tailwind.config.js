/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dream Design Studio palette. The existing token names are kept so
        // every component inherits the new look without a sweeping rewrite:
        // "teal" now reads navy, "copper" now reads gold.
        linen: '#faf7f1',
        cream: '#fffdf8',
        teal: {
          DEFAULT: '#083a4f', // navy
          dark:    '#052a3a', // navy deep
          deeper:  '#041f2b',
          soft:    '#407e8c', // the studio's lighter teal, for accents
        },
        copper: '#a58d66',    // gold
        gold:   '#c9b896',    // gold soft
        aqua:   '#c0d5d6',
        ink:    '#1c2b33',
        muted:  '#5c6e76',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        lora: ['Lora', 'serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderColor: {
        DEFAULT: '#e3ddd2',
      },
    },
  },
  plugins: [],
};
