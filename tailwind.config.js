/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cisco: {
          blue: "#00bceb",
          darkblue: "#0d274d",
          navy: "#04142b",
          green: "#6cc04a",
          gold: "#e2a900",
          orange: "#fbab18",
          red: "#e2231a"
        },
        habbo: {
          bg: "#1a1c2e",
          floor: "#414b66",
          wall: "#293249",
          border: "#121526"
        }
      },
      fontFamily: {
        retro: ['"VT323"', 'monospace', 'Courier New'],
        pixel: ['"Press Start 2P"', 'monospace']
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 0.8s step-start infinite',
        'crt-scan': 'scanline 8s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      }
    },
  },
  plugins: [],
}
