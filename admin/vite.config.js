import path from 'path'
import fs from 'fs'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Resolve a dependency to whichever node_modules actually holds it: admin's own
// (e.g. after `npm ci --workspace=admin` in Docker) or the hoisted workspace root
// (the normal local install). Hardcoding admin/node_modules breaks when deps are
// hoisted — "Cannot read file .../admin/node_modules/react".
const pkgDir = (pkg) => {
  const candidates = [
    path.resolve(__dirname, 'node_modules', pkg),
    path.resolve(__dirname, '../node_modules', pkg),
  ]
  return candidates.find((p) => fs.existsSync(p)) || candidates[candidates.length - 1]
}

export default defineConfig(({ mode }) => {
  // Admin app reads env from admin/.env only (its own project env, not api/.env)
  const envDir = path.resolve(__dirname)
  const env = loadEnv(mode, envDir, '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8029'

  return {
    envDir,
    base: '/admin/',
    plugins: [
      react(),
      // Vite's base middleware 404s /admin (no slash). Redirect so bookmarks and
      // ADMIN_PANEL_URL links that omit the trailing slash still work in dev.
      {
        name: 'redirect-admin-base',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathOnly = (req.url || '').split(/[?#]/)[0]
            if (pathOnly === '/admin') {
              const suffix = (req.url || '').slice('/admin'.length)
              res.writeHead(302, { Location: `/admin/${suffix}` })
              res.end()
              return
            }
            next()
          })
        },
        configurePreviewServer(server) {
          server.middlewares.use((req, res, next) => {
            const pathOnly = (req.url || '').split(/[?#]/)[0]
            if (pathOnly === '/admin') {
              const suffix = (req.url || '').slice('/admin'.length)
              res.writeHead(302, { Location: `/admin/${suffix}` })
              res.end()
              return
            }
            next()
          })
        },
      },
    ],
    resolve: {
      // Force a single copy of React / Router — @shared lives under front/ and
      // otherwise Vite can pull a second react-router-dom from front/node_modules,
      // breaking useLocation() ("Uncaught Error" with empty message).
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, '../front/src/shared'),
        react: pkgDir('react'),
        'react-dom': pkgDir('react-dom'),
        'react-router': pkgDir('react-router'),
        'react-router-dom': pkgDir('react-router-dom'),
        'react-redux': pkgDir('react-redux'),
        '@reduxjs/toolkit': pkgDir('@reduxjs/toolkit'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react-router',
        'react-router-dom',
        'react-redux',
        '@reduxjs/toolkit',
      ],
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
      // App is mounted at /admin/ (same as nginx). Opening / redirects there.
      open: '/admin/',
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
