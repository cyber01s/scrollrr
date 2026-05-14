# ✅ Scrollrr Setup Checklist - Real Impact.com Products

## Required: Get Impact.com Credentials

Your app needs credentials to fetch real affiliate products. Without them, you'll see "End of feed" with no products.

### Step 1: Get Your Impact.com API Credentials

1. **Create/Login to Impact.com Account**
   - Go to https://impact.com/
   - Create account or login (might require approval for some programs)

2. **Find Your Credentials**
   - Go to **Dashboard → Settings → API**
   - Or look for **Integrations → Partners API**
   
   You'll need:
   - **Account SID** (7-8 digit ID) → `IMPACT_ACCOUNT_SID`
   - **Auth Token** (long string) → `IMPACT_AUTH_TOKEN`
   - **Program/Campaign ID** (7 digit ID) → `IMPACT_PROGRAM_ID`

   Example format:
   ```
   IMPACT_ACCOUNT_SID = "1234567"
   IMPACT_AUTH_TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGc..."
   IMPACT_PROGRAM_ID = "9876543"
   ```

### Step 2: Set Environment Variables on Vercel

**⚠️ IMPORTANT: Do NOT hardcode credentials in your code - only in Vercel settings!**

1. Go to https://vercel.com/dashboard
2. Click your **scrollrr** project
3. Go to **Settings → Environment Variables**
4. Add these 3 variables:

   | Key | Value | Environments |
   |-----|-------|--------------|
   | IMPACT_ACCOUNT_SID | your-sid-here | Production, Preview, Development |
   | IMPACT_AUTH_TOKEN | your-token-here | Production, Preview, Development |
   | IMPACT_PROGRAM_ID | your-program-id | Production, Preview, Development |

5. Click **Save** after each one
6. **Redeploy**: Click **Deployments → Redeploy**

### Step 3: Verify It Works

**Check Vercel Logs:**
1. Go to **Vercel Dashboard → scrollrr → Deployments → Latest → Logs**
2. Look for `[Impact] ✓ Credentials loaded successfully`
3. When you load the app, should see: `[Feed] ✓ Returning X products from Impact.com`

**Check in Browser:**
1. Open your app in browser
2. Open **DevTools → Network → api/feed**
3. Should return array of products (not empty)
4. Each product should have `affiliateUrl` field

**Test the Diagnostic Endpoint:**
- Go to: `https://your-app.vercel.app/api/diagnostic`
- Should show: `"message": "✅ All credentials configured"`

### Step 4: Local Development (Optional)

For testing locally:

```bash
# Create .env.local
touch .env.local

# Add your credentials:
IMPACT_ACCOUNT_SID=your-sid
IMPACT_AUTH_TOKEN=your-token
IMPACT_PROGRAM_ID=your-program-id
```

Then:
```bash
npm run dev
# Open http://localhost:5173
```

### Troubleshooting

**Problem: Still showing "End of feed"**
- ❌ Check Vercel logs for `[Impact] ⚠️  CRITICAL: Missing credentials!`
- ✓ Verify all 3 environment variables are set
- ✓ Make sure they're set for **Production** environment
- ✓ Redeploy after adding variables

**Problem: 404 errors from Impact.com API**
- Check credentials are correct on Impact.com dashboard
- Verify Account SID, Auth Token, and Program ID
- Try regenerating credentials on Impact.com

**Problem: "No products returned"**
- May need to wait 5-10 minutes for first request
- Check if your Impact.com account has active products
- Verify program ID is correct

**Problem: API Rate Limiting (429 errors)**
- Normal - app caches for 2 hours
- After 2 hours, cache resets and fetches fresh data
- Don't make many requests in short time

### Data Flow

```
User opens app
    ↓
App requests /api/feed?page=0
    ↓
Vercel checks memory cache
    ↓
Cache empty → Fetches from Impact.com API
  (Uses IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN, IMPACT_PROGRAM_ID)
    ↓
Real affiliate products fetched with tracking URLs
    ↓
Cached for 2 hours
    ↓
Products displayed with affiliate links
    ↓
User clicks product → Earns affiliate commission
```

### Security Notes

- ✓ Credentials stored securely on Vercel (not in code)
- ✓ Environment variables never exposed to browser
- ✓ All API calls made server-side from Vercel function
- ✓ Public only sees product data and affiliate URLs

---

**Need Help?**
1. Check Vercel logs: `vercel logs`
2. Test diagnostic: `/api/diagnostic`
3. Verify credentials on Impact.com dashboard
4. Make sure environment variables are in **Production** environment

**Ready to deploy?**
```bash
git add .
git commit -m "Setup real Impact.com products"
git push
```

Your Vercel app will auto-redeploy with real affiliate products! 🎉
