/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        linen: '#fffdf5',
        teal: {
          DEFAULT: '#1e8b8b',
          dark: '#145f5f',
          deeper: '#0d3535',
        },
        copper: '#c87b33',
        gold: '#edcf30',
        ink: '#2c2c2c',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        lora: ['Lora', 'serif'],
      },
      borderColor: {
        DEFAULT: '#e5e5e0',
      },
    },
  },
  plugins: [],
};
