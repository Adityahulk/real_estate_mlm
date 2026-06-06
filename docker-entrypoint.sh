#!/bin/sh
set -e

echo "▶ Running Prisma migrations..."
# Recover from the broken version of this migration that was briefly deployed.
# PostgreSQL rolls back the migration transaction, but Prisma retains its failed
# migration record and blocks every later startup until it is marked rolled back.
npx prisma migrate resolve --rolled-back 20260606180000_reconcile_payout_schema 2>/dev/null || true
npx prisma migrate deploy

echo "▶ Running seed (idempotent)..."
npm run seed || echo "⚠ Seed skipped (already seeded)"

echo "▶ Starting Next.js server..."
exec node server.js
