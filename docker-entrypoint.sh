#!/bin/sh
set -e

echo "▶ Running Prisma migrations..."
npx prisma migrate deploy

echo "▶ Running seed (idempotent)..."
npm run seed || echo "⚠ Seed skipped (already seeded)"

echo "▶ Starting Next.js server..."
exec node server.js
