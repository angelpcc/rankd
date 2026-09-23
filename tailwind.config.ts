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
        // v4: Inter para leer, Bebas para cifras y titulares, Barlow Condensed
        // para etiquetas en mayúsculas, Unbounded solo para el logotipo.
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        unbounded: ['Unbounded', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        display: ['"Bebas Neue"', 'sans-serif'],
        label: ['"Barlow Condensed"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
