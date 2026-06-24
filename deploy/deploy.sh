#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Installing dependencies..."
npm install

echo "==> Building front and admin (production env from api/.env.production)..."
npm run build:prod

echo "==> Starting services with PM2..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 start ecosystem.config.js --env production
  pm2 save
  echo ""
  echo "Deployed successfully:"
  echo "  Frontend: http://117.254.196.100:8030"
  echo "  Admin:    http://117.254.196.100:8031"
  echo "  API:      http://117.254.196.100:8029/api/health"
  echo ""
  echo "Open firewall ports 8029, 8030, 8031 if not already open."
else
  echo "PM2 not found. Install with: npm install -g pm2"
  echo "Then run: pm2 start ecosystem.config.js --env production"
  exit 1
fi
