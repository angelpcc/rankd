/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        rankd: {
          red: '#E10600',
          black: '#0B0B0B',
          dark: '#1A1A1A',
          white: '#FFFFFF',
        },
      },
      fontFamily: {
        unbounded: ['Unbounded', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
