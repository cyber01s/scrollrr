<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Scrollr - AI-Powered Affiliate Feed

An AI-powered affiliate product feed optimized for impact.com with a TikTok-style scrolling interface and smart descriptions.

## Features

- 🎬 TikTok-style scrolling interface for product discovery
- 🤖 AI-generated product descriptions using Google Gemini
- 🛍️ Impact.com affiliate integration with real product data
- 📱 Fully responsive design optimized for mobile
- ⚡ Built with React, Vite, and Tailwind CSS
- 🚀 Serverless deployment ready for Vercel

## Setup

### Prerequisites
- Node.js 18+
- Vercel account (for deployment)
- Google Gemini API key
- Impact.com API credentials

### Configuration

1. Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

2. Set your environment variables in `.env.local`:

```env
# Impact.com API Credentials
IMPACT_ACCOUNT_SID=your_account_sid_here
IMPACT_AUTH_TOKEN=your_auth_token_here
IMPACT_PROGRAM_ID=your_program_id_here

# Google Gemini API Key (for AI descriptions)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173`

## Building

```bash
npm run build
```

This creates a production build in the `dist/` directory.

## Deployment to Vercel

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Add environment variables in the Vercel dashboard under Project Settings > Environment Variables:
   - `IMPACT_ACCOUNT_SID`
   - `IMPACT_AUTH_TOKEN`
   - `IMPACT_PROGRAM_ID`
   - `GEMINI_API_KEY`

### Option 2: Using GitHub Integration

1. Push your code to GitHub
2. Import your repository in Vercel dashboard
3. Set environment variables in Project Settings
4. Vercel will automatically deploy on each push

## API Endpoints

The app uses serverless API routes available at `/api/`:

- `GET /api/products?page=1&limit=3` - Fetch paginated products from Impact.com
- `POST /api/ai-description` - Generate AI-powered product descriptions

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `IMPACT_ACCOUNT_SID` | Impact.com Media Partner Account ID | Yes* |
| `IMPACT_AUTH_TOKEN` | Impact.com API authentication token | Yes* |
| `IMPACT_PROGRAM_ID` | Impact.com Campaign ID | No |
| `GEMINI_API_KEY` | Google Gemini API key for AI descriptions | No** |

\* Required for live Impact.com data (falls back to mock data if not set)
\** If not set, uses placeholder descriptions

## Project Structure

```
├── src/
│   ├── App.tsx          # Main React component
│   ├── main.tsx         # React entry point
│   └── index.css        # Global styles
├── api/
│   ├── products.ts      # Serverless function for product fetching
│   └── ai-description.ts # Serverless function for AI descriptions
├── vite.config.ts       # Vite configuration
├── vercel.json          # Vercel deployment configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Project dependencies
```

## Development Notes

- The app uses Vite for fast development and optimized builds
- Vercel serverless functions handle all API requests
- Product data is fetched from Impact.com with fallback mock data
- AI descriptions are generated on-demand using Google Gemini

## License

Apache-2.0
