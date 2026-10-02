/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07090e',
          900: '#0c1017',
          850: '#111622',
          800: '#171e2e',
          700: '#222d42',
          600: '#313f5c',
        },
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        neon: {
          orange: '#4f46e5', // Replaced garish neon with refined Indigo Primary
          amber: '#6366f1',
          glow: '#818cf8',
          bright: '#4338ca',
          gold: '#38bdf8',
        }
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.25)',
        'card': '0 4px 12px -2px rgba(0, 0, 0, 0.35)',
        'elevated': '0 12px 24px -4px rgba(0, 0, 0, 0.45)',
        'neon': '0 2px 8px rgba(79, 70, 229, 0.25)',
        'neon-lg': '0 8px 24px rgba(79, 70, 229, 0.3)',
        'neon-sm': '0 1px 4px rgba(79, 70, 229, 0.2)',
        'glass': '0 4px 20px 0 rgba(0, 0, 0, 0.35)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'royal-gradient': 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(12,16,23,0.95) 100%)',
        'glass-card': 'linear-gradient(145deg, rgba(17, 22, 34, 0.8) 0%, rgba(12, 16, 23, 0.9) 100%)',
      }
    },
  },
  plugins: [],
}
