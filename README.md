# Shree Shyam Villa - 2

Production-oriented real-estate member, binary-tree, payment, payout, KYC, draw, and administration portal.

## Local Setup

1. Copy `.env.example` to `.env` and provide PostgreSQL, JWT, and PII encryption values.
2. Install dependencies with `npm install`.
3. Apply the schema with `npx prisma migrate deploy`.
4. Initialize settings and the first admin with `npm run seed`.
5. Start the app with `npm run dev`.

The seed is idempotent. It creates business settings, commission rules, and the initial admin only. It never creates demo members, plots, payments, or draws, and it never resets an existing admin password.

## Production Requirements

- Set a long random `JWT_SECRET`.
- Set a permanent 64-character hexadecimal `PII_ENCRYPTION_KEY`. Changing it makes encrypted Aadhaar and bank data unreadable.
- Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before the first deployment.
- Configure SMTP or Resend for password-reset emails.
- Mount persistent storage at `STORAGE_DIR` for KYC files, plot documents, insurance documents, and receipts.
- Run behind HTTPS and preserve `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers.

Docker startup applies pending Prisma migrations, ensures settings and the initial admin exist, and then starts the application.

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```
