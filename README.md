# Shree Shyam Villa - 2

Production-oriented real-estate member, binary-tree, payment, payout, KYC, draw, and administration portal.

## Local Setup

1. Copy `.env.example` to `.env` and provide PostgreSQL, JWT, and PII encryption values.
2. Install dependencies with `npm install`.
3. Apply the schema with `npx prisma migrate deploy`.
4. Initialize settings and the first admin with `npm run seed`.
5. Start the app with `npm run dev`.

The seed is idempotent. It creates business settings, commission rules, and the initial admin only. It never creates demo members, plots, payments, or draws, and it never resets an existing admin password.

## Demo Reset

To clear customer/test data while preserving the admin account and create one
free demo member:

```bash
npm run db:reset:demo
```

Demo login:

```text
Member ID: SSV000001
Mobile: 9876543210
Password: 123456
Sponsor ID: COMPANY
```

Normal members choose their own password during registration. Generated Member
IDs and mobile numbers are always stored separately; only generated Member IDs
are accepted as Sponsor IDs.

## Production Requirements

- Set a long random `JWT_SECRET`.
- Set a permanent 64-character hexadecimal `PII_ENCRYPTION_KEY`. Changing it makes encrypted Aadhaar and bank data unreadable.
- Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before the first deployment.
- Configure SMTP or Resend for password-reset emails.
- Mount persistent storage at `STORAGE_DIR` for KYC files, plot documents, insurance documents, and receipts.
- Run behind HTTPS and preserve `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto` headers.

Docker startup applies pending Prisma migrations, ensures settings and the initial admin exist, and then starts the application.

## Clean Production Database

This removes every customer, application, plot, payment, payout, draw, KYC record,
notification, OTP, and audit log. It preserves system settings and commission rules,
then creates exactly one admin and the hidden `COMPANY` sponsor:

```bash
CONFIRM_PRODUCTION_RESET=DELETE_ALL_CUSTOMER_DATA \
RESET_ADMIN_EMAIL=admin@your-domain.com \
RESET_ADMIN_PASSWORD='use-a-strong-password' \
npm run db:clean:production
```

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```
