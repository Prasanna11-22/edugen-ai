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
          950: '#030406',
          900: '#07080c',
          850: '#0c0e14',
          800: '#12151f',
          700: '#1b202e',
          600: '#272d40',
        },
        neon: {
          orange: '#ff6200',
          amber: '#ff8500',
          glow: '#ffa600',
          bright: '#ff4800',
          gold: '#ffb703',
        }
      },
      boxShadow: {
        'neon': '0 0 20px rgba(255, 98, 0, 0.35)',
        'neon-lg': '0 0 35px rgba(255, 98, 0, 0.55)',
        'neon-sm': '0 0 10px rgba(255, 98, 0, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.55)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(255, 133, 0, 0.15)',
      },
      backgroundImage: {
        'royal-gradient': 'linear-gradient(135deg, rgba(255,98,0,0.15) 0%, rgba(10,12,18,0.95) 100%)',
        'glass-card': 'linear-gradient(145deg, rgba(22, 26, 38, 0.7) 0%, rgba(9, 11, 17, 0.85) 100%)',
        'orange-radial': 'radial-gradient(circle at 50% 0%, rgba(255, 98, 0, 0.18) 0%, transparent 70%)',
      }
    },
  },
  plugins: [],
}
