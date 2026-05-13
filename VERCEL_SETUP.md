# Vercel Deployment Setup Guide

## ⚙️ Required Environment Variables on Vercel

To get real Impact.com affiliate products working on Vercel, you MUST set these environment variables in your Vercel project settings:

### 1. **Impact.com API Credentials (REQUIRED)**

These are critical. Without them, the app will show "End of feed" with no products.

#### Get Your Credentials:
1. Go to [Impact.com Dashboard](https://impact.com)
2. Navigate to **Settings → API** (or **Integrations → APIs**)
3. Find or generate your **API Credentials**

#### Required Variables:
- **IMPACT_ACCOUNT_SID** - Your Account/Partner ID (usually 7-8 digits)
- **IMPACT_AUTH_TOKEN** - Your API Authentication Token
- **IMPACT_PROGRAM_ID** - Your Program/Campaign ID (usually 7 digits)

### 2. How to Set Variables on Vercel

#### Option A: Via Vercel Dashboard (Recommended)
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your **scrollrr** project
3. Click **Settings** → **Environment Variables**
4. Add each variable:
   - Name: `IMPACT_ACCOUNT_SID`
   - Value: `your-actual-sid-here`
   - Select: **Production, Preview, Development**
5. Repeat for `IMPACT_AUTH_TOKEN` and `IMPACT_PROGRAM_ID`
6. Click **Save**

#### Option B: Via Vercel CLI
```bash
vercel env add IMPACT_ACCOUNT_SID
# Paste your SID value
# Select: Production, Preview, Development

vercel env add IMPACT_AUTH_TOKEN
# Paste your auth token

vercel env add IMPACT_PROGRAM_ID
# Paste your program ID
```

### 3. Verify Setup

After adding variables:

1. **Redeploy** your app:
   ```bash
   vercel --prod
   ```

2. **Check Vercel Logs**:
   - Go to **Vercel Dashboard** → **scrollrr** → **Deployments** → Latest → **Logs**
   - Look for: `[Feed] Fetching from Impact.com API...`
   - Should see: `[Feed] Returning X products from Impact.com`
   - If you see `[Impact] Failed after 2 attempts: Request failed with status code 404`, check your credentials

3. **Test in Browser**:
   - Open your app URL
   - Open **Browser DevTools → Network**
   - Load page and check `/api/feed` request
   - Should return array of products with `affiliateUrl` fields
   - If you see `[]` (empty array), credentials are likely wrong

### 4. Data Flow

```
App requests → /api/feed?page=0
↓
Vercel Function checks memory cache
↓
If not cached, fetches from Impact.com API with credentials
↓
Returns normalized products with affiliate URLs
↓
App displays products in infinite scroll
```

### 5. Troubleshooting

**Problem: "End of feed" with no products**
- Check Vercel logs for errors
- Verify all 3 environment variables are set
- Check credentials are correct on Impact.com dashboard
- Ensure variables are set for **Production** environment

**Problem: 404 errors from Impact.com**
- Credentials likely invalid
- Verify IMPACT_ACCOUNT_SID is correct
- Ensure IMPACT_AUTH_TOKEN hasn't expired
- Check IMPACT_PROGRAM_ID exists

**Problem: Same products cached**
- This is normal (2-hour cache per page)
- Memory cache clears on redeployment
- Testing: Redeploy to clear cache

**Problem: Slow loading**
- First request fetches from Impact.com (3-4s)
- Subsequent requests use 2-hour memory cache (instant)
- Normal behavior

### 6. Local Development

For local testing:

```bash
# Create .env.local
cp .env.example .env.local

# Add your credentials
IMPACT_ACCOUNT_SID=your-sid
IMPACT_AUTH_TOKEN=your-token
IMPACT_PROGRAM_ID=your-program-id
```

Run locally:
```bash
npm run dev
# Open http://localhost:5173
```

Check logs in terminal for `[Feed] Fetching...` messages.

---

**Questions?** Check your Vercel function logs and ensure all 3 environment variables are present and correct.
