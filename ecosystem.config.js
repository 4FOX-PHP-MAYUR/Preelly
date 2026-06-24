const path = require('path')
const fs = require('fs')

const rootDir = path.join(__dirname, '..')
const apiDir = path.join(rootDir, 'api')
const viteBin = path.join(rootDir, 'node_modules/vite/bin/vite.js')

const apiScript = fs.existsSync(path.join(apiDir, 'dist', 'index.js'))
  ? 'dist/index.js'
  : fs.existsSync(path.join(apiDir, 'index.js'))
    ? 'index.js'
    : 'server.js'

module.exports = {
  apps: [
    {
      name: 'preelly-api',
      script: apiScript,
      cwd: apiDir,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'preelly-front',
      script: viteBin,
      args: 'preview --host 0.0.0.0 --port 8030',
      cwd: path.join(rootDir, 'front'),
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'preelly-admin',
      script: viteBin,
      args: 'preview --host 0.0.0.0 --port 8031',
      cwd: path.join(rootDir, 'admin'),
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
