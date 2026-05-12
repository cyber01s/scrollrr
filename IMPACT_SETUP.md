# Impact.com Integration Guide

This guide explains how to set up real affiliate links from Impact.com and fetch actual product data.

## What Changed

The app has been updated to:
1. ✅ Fetch **real products** from Impact.com API
2. ✅ Use **real affiliate links** from your partner catalog
3. ✅ Display actual product images and pricing
4. ✅ Handle image fallbacks with gradient backgrounds
5. ✅ Show errors if credentials are missing or invalid

## Getting Your Impact.com Credentials

### 1. Get Your Account SID
- Log in to your Impact.com account
- Go to **Settings** > **Personal Settings**
- Find your **Media Partner Account ID** (this is your `IMPACT_ACCOUNT_SID`)
- Example: `account123abc`

### 2. Get Your Auth Token
- In the same settings area, navigate to **Settings** > **API Credentials**
- Generate or retrieve your **Authentication Token** (this is your `IMPACT_AUTH_TOKEN`)
- This is a secure credential - keep it private!

### 3. Get Your Program ID (Optional but Recommended)
- Go to **Campaigns** or **Programs**
- Select the campaign/program you want products from
- Find the **Campaign ID** or **Program ID** (this is your `IMPACT_PROGRAM_ID`)
- Example: `campaign456def`

## Setting Environment Variables on Vercel

### Step 1: Go to Your Vercel Project
1. Open https://vercel.com/dashboard
2. Select your **scrollrr** project

### Step 2: Add Environment Variables
1. Click **Settings** > **Environment Variables**
2. Add these variables:

```
IMPACT_ACCOUNT_SID=your_account_id_here
IMPACT_AUTH_TOKEN=your_auth_token_here
IMPACT_PROGRAM_ID=your_program_id_here
GEMINI_API_KEY=your_gemini_key_here
```

**Important:** Set these variables for "Production" environment

### Step 3: Redeploy
1. Go to **Deployments**
2. Click the three dots on the latest deployment
3. Select **Redeploy**

Or push a new commit:
```bash
git commit --allow-empty -m "Trigger deployment with env vars"
git push
```

## How Real Affiliate Links Work

### Data Flow:
1. **Frontend** → Requests `/api/products`
2. **Backend API** → Authenticates with Impact.com using your credentials
3. **Impact.com** → Returns your product catalog with affiliate URLs
4. **Backend** → Processes and returns products with real affiliate links
5. **Frontend** → Displays products with "Shop Now via Partner" button
6. **User clicks** → Navigates to real affiliate link

### Real Affiliate Links Example:
```
❌ Before (placeholder):
https://impact.com/example-affiliate-link

✅ After (real affiliate link):
https://partner.com/product/item-123?aff=YOUR_ACCOUNT_SID&utm_source=scrollrr
```

## Testing Locally

1. Create `.env.local`:
```bash
cp .env.example .env.local
```

2. Add your credentials:
```
IMPACT_ACCOUNT_SID=your_id
IMPACT_AUTH_TOKEN=your_token
IMPACT_PROGRAM_ID=your_program_id
GEMINI_API_KEY=your_key
```

3. Run locally:
```bash
npm install
npm run dev
```

4. Open http://localhost:5173
5. Check browser console for any errors
6. Products should load with real data from Impact.com

## Troubleshooting

### Issue: "No products found"
**Cause:** Invalid credentials or program ID  
**Solution:**
- Verify `IMPACT_ACCOUNT_SID` is correct
- Verify `IMPACT_AUTH_TOKEN` is not expired
- Try without `IMPACT_PROGRAM_ID` first

### Issue: "Configuration Error"
**Cause:** Missing environment variables  
**Solution:**
- Check Vercel Environment Variables are set
- Redeploy after adding variables
- Check backend logs in Vercel > Logs

### Issue: Affiliate links are "#" or blank
**Cause:** Impact.com API not returning URL field  
**Solution:**
- Check that products have associated URLs in Impact.com
- Verify your program/campaign has affiliate links enabled
- Contact Impact.com support

### Issue: Images not loading
**Cause:** Missing or invalid image URLs from API  
**Solution:**
- Products will show with gradient background instead
- Verify Impact.com API returns ImageUrl field
- Check Image URLs in Impact.com product catalog

## Understanding the API Response

The `/api/products` endpoint returns:

```json
{
  "products": [
    {
      "id": "product-123",
      "name": "Product Name",
      "category": "ELECTRONICS",
      "price": 99.99,
      "oldPrice": 129.99,
      "discount": "-23%",
      "rating": 4.7,
      "reviews": 1250,
      "imageUrl": "https://...",
      "affiliateLink": "https://partner.com/product?aff=...",
      "brand": "Brand Name",
      "sku": "SKU123"
    }
  ],
  "hasMore": true,
  "total": 1500,
  "currentPage": 1,
  "pageSize": 3
}
```

## API Field Mapping

The API automatically maps Impact.com fields:

| Impact.com Field | Our Field | Purpose |
|---|---|---|
| `Id` | `id` | Unique product ID |
| `Name` | `name` | Product name |
| `Category` / `CategoryName` | `category` | Product category |
| `Price` / `SalePrice` | `price` | Current price |
| `RetailPrice` / `ListPrice` | `oldPrice` | Original/retail price |
| `Url` / `Link` / `ProductUrl` | `affiliateLink` | Real affiliate link |
| `ImageUrl` / `Image` | `imageUrl` | Product image |
| `BrandName` | `brand` | Brand name |
| `SKU` / `Sku` | `sku` | Product SKU |
| `Rating` | `rating` | Product rating |
| `ReviewCount` / `Reviews` | `reviews` | Number of reviews |

## Next Steps

1. ✅ Set up Impact.com account and get credentials
2. ✅ Add environment variables to Vercel
3. ✅ Redeploy the application
4. ✅ Test in production
5. 📊 Monitor clicks and conversions
6. 🎯 Optimize product selection and order

## Support Resources

- **Impact.com API Docs:** https://developer.impact.com/
- **Impact.com Support:** https://support.impact.com/
- **Vercel Docs:** https://vercel.com/docs
- **Our Repo:** Check the main README.md

## Important Notes

⚠️ **Security:**
- Never commit `.env.local` to git
- Always use environment variables for credentials
- Rotate auth tokens periodically
- Use `https://` only for affiliate links

📈 **Best Practices:**
- Monitor your affiliate link clicks
- Test affiliate links work in production
- Ensure product images load properly
- Keep product catalog updated
- Track conversion metrics

✨ **Features Enabled:**
- Real product data from Impact.com
- Actual affiliate links (not placeholders)
- AI-generated product descriptions
- Image error handling
- Error messaging for configuration issues
