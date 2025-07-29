/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scans all JS/TSX files in src
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'var(--primary-50)', // #f0f9ff
          100: 'var(--primary-100)', // #e0f2fe
          500: 'var(--primary-500)', // #0ea5e9
          600: 'var(--primary-600)', // #0284c7
          700: 'var(--primary-700)', // #0369a1
        },
        neutral: {
          100: 'var(--neutral-100)', // #ffffff
          200: 'var(--neutral-200)', // #f8fafc
          300: 'var(--neutral-300)', // #e2e8f0
          600: 'var(--neutral-600)', // #475569
          800: 'var(--neutral-800)', // #0f172a
        },
        accent: {
          400: 'var(--accent-400)', // #f59e0b
        },
      },
      backgroundOpacity: (theme) => ({
        ...theme('opacity'), // Include default opacity values
        80: '0.8', // Add custom 80% opacity
      }),
    },
  },
  plugins: [],
};