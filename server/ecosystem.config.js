const fs = require('fs')
const path = require('path')

const script = fs.existsSync(path.join(__dirname, 'dist', 'index.js'))
  ? 'dist/index.js'
  : fs.existsSync(path.join(__dirname, 'index.js'))
    ? 'index.js'
    : 'server.js'

module.exports = {
  apps: [
    {
      name: 'node-api',
      script,
      cwd: __dirname,
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
