import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Admin app reads env from admin/.env only (its own project env, not api/.env)
  const envDir = path.resolve(__dirname)
  const env = loadEnv(mode, envDir, '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8029'

  return {
    envDir,
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, '../front/src/shared'),
      },
      modules: [
        path.resolve(__dirname, 'node_modules'),
        path.resolve(__dirname, '../node_modules'),
        'node_modules',
      ],
    },
    server: {
      fs: {
        allow: [path.resolve(__dirname, '..')],
      },
      host: true,
      port: 8031,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/uploads': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    preview: {
      host: '0.0.0.0',
      port: 8031,
      strictPort: true,
    },
  }
})
