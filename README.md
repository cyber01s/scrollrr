# Scrollr

A TikTok-style fullscreen vertical scroll feed for affiliate products from ALL programs the publisher is enrolled in on impact.com.

## Architecture

```
Impact.com API -> Vercel Cron (Nightly) -> Neon PostgreSQL -> Upstash Redis (Cache) -> Vercel Edge API -> Next.js Client
```

- **Next.js 14 App Router** running on Vercel with ISR caching.
- **Neon** Serverless Postgres (HTTP Client) for storing discovered partners, products, click events, and full-text search vectors.
- **Upstash Redis** (HTTP Client) for edge caching feed pages and search results, and API rate limiting.
- **Vercel** Edge Runtime used for user-facing API paths.
- **Vercel Cron** handles impact.com synchronization securely behind-the-scenes.

## Environment Config

Set these in Vercel Dashboard -> Environment Variables:

- `NEXT_PUBLIC_APP_URL` — Public web URL
- `IMPACT_ACCOUNT_SID` — Your Impact.com Account SID
- `IMPACT_AUTH_TOKEN` — Your Impact.com Auth Token
- `DATABASE_URL` — Neon DB connection string with `?sslmode=require`
- `UPSTASH_REDIS_URL` — Upstash REST API base URL
- `UPSTASH_REDIS_TOKEN` — Upstash REST API token
- `CRON_SECRET` — 32-character random hex string for your scheduled cron authorization

## How to Deploy

1. Initialize git and push to your GitHub repo.
2. Link the repository to a new Vercel project with Next.js framework preset.
3. Configure Environment Variables in Vercel.
4. Add your domain inside Vercel.
5. Deploy using `vercel --prod` or push to your `main` branch.

## Initial Setup (Post-Deploy)

1. First, establish DB schemas: `npx tsx scripts/migrate.ts`
2. Second, trigger the first Impact.com scan manually by making a POST to `/api/admin/revalidate` with header: `Authorization: Bearer <CRON_SECRET>`

## Multi-partner Support

The nightly cron `/api/cron/sync-products` queries Impact's `Campaigns/` endpoint first. It stores any Campaign that is `STATUS='ACTIVE'` and has a `CatalogId` in your `partners` table. Then, it sweeps every mapped catalog into your `products` table. Therefore, to add new partners you simply join their affiliate program via impact.com. Tomorrow morning they will automatically appear in Scrollr.

You can manually trigger a sync via `POST /api/admin/revalidate` using `CRON_SECRET` at any time.
