# Vercel Deployment Guide

This guide will help you deploy the Scrollr app to Vercel with Impact.com integration.

## Prerequisites

Before deploying, ensure you have:
1. A Vercel account (https://vercel.com)
2. A GitHub account with your repository pushed
3. Google Gemini API credentials
4. Impact.com API credentials:
   - Account SID (Media Partner Account ID)
   - Auth Token (API Authentication Token)
   - Program ID (Campaign ID) - optional but recommended

## Step 1: Prepare Your Repository

1. Make sure all changes are committed to git:
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. Verify the following files exist in your repository root:
   - `vercel.json` - Vercel configuration
   - `.vercelignore` - Files to exclude from deployment
   - `vite.config.ts` - Vite frontend build configuration
   - `package.json` - Updated with Vercel dependencies
   - `api/products.ts` - Serverless function for products
   - `api/ai-description.ts` - Serverless function for AI

## Step 2: Deploy to Vercel

### Option A: Import from GitHub (Recommended)

1. Go to https://vercel.com/dashboard
2. Click "Add New..." > "Project"
3. Select "Import Git Repository"
4. Search for your repository and select it
5. Click "Import"
6. Configure project settings (defaults usually fine)
7. Click "Deploy"

### Option B: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. In your project directory, run:
   ```bash
   vercel
   ```

3. Follow the prompts:
   - Link to your existing Vercel project or create a new one
   - Confirm project name and settings
   - Wait for deployment to complete

## Step 3: Configure Environment Variables

Once deployment is initiated, you need to add environment variables:

1. Go to your project in Vercel dashboard
2. Click "Settings" > "Environment Variables"
3. Add the following variables:

   **For Impact.com Integration:**
   - `IMPACT_ACCOUNT_SID` - Your Media Partner Account ID
   - `IMPACT_AUTH_TOKEN` - Your API Authentication Token
   - `IMPACT_PROGRAM_ID` - Your Campaign ID (optional)

   **For AI Descriptions:**
   - `GEMINI_API_KEY` - Your Google Gemini API key

4. Set the environment availability to "Production"
5. Click "Save"

## Step 4: Redeploy

After adding environment variables, you need to trigger a new deployment:

1. Go to "Deployments" tab
2. Click the three dots on the latest deployment
3. Select "Redeploy"
4. Wait for the deployment to complete

Or push a new commit to trigger automatic deployment:
```bash
git commit --allow-empty -m "Trigger deployment with env vars"
git push
```

## Step 5: Verify Deployment

1. Once deployment is complete, click the "Visit" button to view your live app
2. Test the app:
   - Scroll through products
   - Check that product data is loading
   - Click "Info" button to test AI descriptions
   - Verify affiliate links work

## Troubleshooting

### Products not loading
- Check that `IMPACT_ACCOUNT_SID` and `IMPACT_AUTH_TOKEN` are correctly set
- The app will fall back to mock data if credentials are invalid
- Check Vercel logs: Settings > Functions > Logs

### AI descriptions not working
- Verify `GEMINI_API_KEY` is set in environment variables
- Check that your Gemini API quota is not exceeded
- The app will use fallback descriptions if Gemini API fails

### Build fails
- Ensure all dependencies are installed locally: `npm install`
- Check that the `vercel.json` file is present
- Verify `package.json` has the correct build script: `"build": "vite build"`

### CORS errors
- The API routes include CORS headers
- If issues persist, check browser console for specific error messages

## Monitoring

After deployment:

1. **Check Deployment Status:**
   - Visit Vercel dashboard > Deployments
   - Each deployment shows status and build logs

2. **View Runtime Logs:**
   - Vercel dashboard > Settings > Functions
   - Select `/api/products` or `/api/ai-description` to view logs

3. **Monitor Errors:**
   - Enable error tracking in Vercel or use external services
   - Review Function logs regularly

## Local Development

To test locally before deploying:

1. Copy `.env.example` to `.env.local`
2. Fill in your credentials in `.env.local`
3. Run `npm run dev`
4. Open http://localhost:5173
5. Test functionality locally

## Next Steps

- Monitor your analytics and user engagement
- Consider implementing analytics tracking
- Set up error monitoring
- Plan content updates and product feed refreshes

## Support

For issues with:
- **Vercel deployment:** Visit https://vercel.com/docs
- **Impact.com API:** Check https://impact.com/api-documentation
- **Google Gemini:** Visit https://ai.google.dev/
