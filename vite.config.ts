import { defineConfig } from 'vite'
declare const process: { env: Record<string, string | undefined> }
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    proxy: {
      '/api': {
        // backend FastAPI; per puntarne un altro: API_TARGET=http://host:porta npm run dev
        target: process.env.API_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true, // console dei dispositivi CML via WebSocket
      },
    },
  },
})
