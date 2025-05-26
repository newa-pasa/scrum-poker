import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    port: 3000, // Port for the Vite dev server (React app)
    proxy: {
      '/api': { // Proxy API requests
        target: 'http://localhost:3001', // Your Express server
        changeOrigin: true,
      },
    },
  },
})