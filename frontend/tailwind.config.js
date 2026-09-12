/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ville: {
          DEFAULT: '#0055A4',
          dark: '#003d75',
        },
      },
    },
  },
  plugins: [],
};
