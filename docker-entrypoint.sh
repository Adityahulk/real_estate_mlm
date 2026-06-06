#!/bin/sh
set -e

echo "▶ Syncing DB schema..."
npx prisma db push --accept-data-loss

echo "▶ Running seed (idempotent)..."
npm run seed || echo "⚠ Seed skipped or failed (non-fatal if already seeded)"

echo "▶ Starting Next.js server..."
exec node server.js
