/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        command: {
          950: '#161616', // Main Canvas Background (Pure Dark Charcoal)
          900: '#242424', // Cards & Sidebar (Deep Gunmetal Surface)
          800: '#2c2c2c', // Lighter hover states
          700: '#383838', // Neutral Steel Border
          border: '#383838' // Thin borders
        },
        tactical: {
          cyan: '#00e5ff',
          cyanGlow: 'rgba(0, 229, 255, 0.4)',
          cyanDark: '#00838f',
          gold: '#ffb300',
          goldGlow: 'rgba(255, 179, 0, 0.4)',
          goldDark: '#b27d00',
          green: '#00e676',
          amber: '#ff9100',
          red: '#ff1744',
          gray: '#8f939c' // Muted gray for secondary info
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-spin': 'spin 10s linear infinite',
        'glow-pulse': 'glow 2s ease-in-out infinite alternate',
        'glow-pulse-cyan': 'glowCyan 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 179, 0, 0.2)' },
          '100%': { boxShadow: '0 0 15px rgba(255, 179, 0, 0.6)' }
        },
        glowCyan: {
          '0%': { boxShadow: '0 0 5px rgba(0, 229, 255, 0.2)' },
          '100%': { boxShadow: '0 0 15px rgba(0, 229, 255, 0.6)' }
        }
      }
    },
  },
  plugins: [],
}
