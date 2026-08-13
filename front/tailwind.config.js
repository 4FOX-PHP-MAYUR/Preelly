/** @type {import('tailwindcss').Config} */
const brandScale = {
  DEFAULT: '#0000FF',
  50: '#E6E6FF',
  100: '#CCCCFF',
  200: '#9999FF',
  300: '#6666FF',
  400: '#3333FF',
  500: '#0000FF',
  600: '#0000FF',
  700: '#0000DD',
  800: '#0000BB',
  900: '#000099',
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/shared/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  safelist: ['font-helvetica', 'font-helvetica-neue'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
        helvetica: ['Helvetica', 'Arial', 'sans-serif'],
        'helvetica-neue': ['"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: brandScale,
        primary: brandScale,
        variant: {
          DEFAULT: '#21357C',
        },
        ink: {
          DEFAULT: '#364153',
        },
        admin: {
          sidebar: '#020617',
          surface: '#ffffff',
          muted: '#64748b',
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.25s ease-out',
        'drawer-slide-in': 'drawer-slide-in 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
      },
      keyframes: {
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'drawer-slide-in': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
