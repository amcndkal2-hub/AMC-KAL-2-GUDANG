#!/bin/bash
# Auto-migrate and start webapp with PM2

echo "🔧 Applying D1 migrations..."
npx wrangler d1 migrations apply amc-material-db --local

echo "🚀 Starting webapp with PM2..."
pm2 delete webapp 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
pm2 start ecosystem.config.cjs

echo "✅ Webapp started!"
echo "📊 Check logs: pm2 logs webapp --nostream"
echo "🌐 Access: http://localhost:3000"
