# Daftar Harga

Product price management app.

## Setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # fill in DATABASE_URL
cp apps/web/.env.example apps/web/.env
pnpm --filter api exec prisma generate
pnpm dev
```
