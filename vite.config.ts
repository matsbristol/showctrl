import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Live backend while developing: run `npm run dev:worker` in one terminal and
// `SHOWCTRL_API=http://localhost:8787 npm run dev` in another. Without SHOWCTRL_API
// the app runs in demo mode.
const api = process.env.SHOWCTRL_API

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    middlewareMode: false,
    proxy: api ? {
      '/api': { target: api, ws: true, changeOrigin: true },
      '/time': { target: api, changeOrigin: true },
    } : undefined,
  },
  preview: {
    port: 5173,
  },
})
