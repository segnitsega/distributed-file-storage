import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const masterUrl = env.VITE_MASTER_URL || 'http://localhost:8000'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/upload': { target: masterUrl, changeOrigin: true },
        '/download': { target: masterUrl, changeOrigin: true },
        '/files': { target: masterUrl, changeOrigin: true },
        '/nodes': { target: masterUrl, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      globals: true,
    },
  }
})
