/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#f5f7ef',
          100: '#e7ecd9',
          200: '#d4dfb7',
          300: '#c1d194',
          400: '#afc37d',
          500: '#9aae66',
          600: '#7c9250',
          700: '#627644',
          800: '#4a5b38',
          900: '#35422e',
          950: '#20291c',
        },
        studio: {
          bg: '#111310',
          surface: '#191c18',
          surfaceLight: '#22261f',
          surfaceHover: '#2b3028',
          border: '#343a30',
          borderLight: '#464e40',
          text: '#f2f2eb',
          textMuted: '#b0b4a8',
          textSubtle: '#858b7d',
          accent: '#a4b67c',
          accentHover: '#91a66a',
          accentGlow: 'rgba(164, 182, 124, 0.14)',
          success: '#78bd94',
          warning: '#d8aa62',
          danger: '#df7770',
          cyan: '#a4b67c',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
