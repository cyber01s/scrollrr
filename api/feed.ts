import { IncomingMessage } from 'http';
import axios from 'axios';
import { Buffer } from 'buffer';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: any;
}

interface VercelResponse {
  status: (code: number) => VercelResponse;
  json: (data: any) => void;
  setHeader: (key: string, value: string) => VercelResponse;
  end: () => void;
}

// Impact.com Configuration
const SIDs = (process.env.IMPACT_ACCOUNT_SID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const TOKENS = (process.env.IMPACT_AUTH_TOKEN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const PROGRAM_IDS = (process.env.IMPACT_PROGRAM_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const IMPACT_PARTNER_PROPERTY_ID = "6988584";
const hasImpactCreds = SIDs.length > 0 && TOKENS.length > 0;
const CACHE_TTL = 3600 * 2; // 2 hours cache
const API_TIMEOUT = 4000; // 4 second timeout per request
const MAX_RETRIES = 2;

// Simple in-memory cache for Vercel (survives cold starts within a deployment)
const memoryCache: Record<string, { data: any[], timestamp: number }> = {};

function getAuth(index: number) {
  let sid = SIDs[index] || SIDs[0];
  let token = TOKENS[index] || TOKENS[0];
  return {
    sid,
    token,
    header: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
  };
}

function normalizeProduct(raw: any, sid: string) {
  if (!raw) return null;
  
  const price = parseFloat(String(raw.Price || raw.CurrentPrice || "0"));
  if (isNaN(price) || price <= 0) return null;

  const originalPrice = raw.OriginalPrice ? parseFloat(String(raw.OriginalPrice)) : null;
  const campaignId = String(raw.CatalogId || PROGRAM_IDS[0] || "1236776");
  
  // Filter out unwanted campaigns
  if (campaignId === "18350" || campaignId === "12108") {
    return null;
  }
  
  const destUrl = String(raw.TrackingUrl || raw.TrackingLink || raw.ProductUrl || raw.Url || "");
  if (!destUrl || destUrl.length < 10) return null;

  // Use Impact.com tracking URL directly when available
  let affiliateUrl = destUrl;
  if (raw.TrackingUrl) {
    // Already has tracking built in
    affiliateUrl = destUrl;
  } else if (sid && !destUrl.includes("/c/") && !destUrl.includes("sjv.io") && !destUrl.includes("impact.com")) {
    // Wrap in sjv.io if not already wrapped
    affiliateUrl = `https://buybestgear.sjv.io/c/${sid}/${campaignId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${IMPACT_PARTNER_PROPERTY_ID}`;
  }

  const desc = String(raw.Description || "").substring(0, 200);

  return {
    id: String(raw.Id || raw.ProductId || `prod-${Math.random()}`),
    name: String(raw.Name || raw.ProductName || "Product").substring(0, 150),
    category: String(raw.Category || "Uncategorized").substring(0, 50),
    imageUrl: String(raw.ImageUri || raw.ImageLink || raw.ImageUrl || ""),
    price: price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
    currency: String(raw.Currency || "USD"),
    rating: raw.Rating ? Math.min(5, Math.max(0, parseFloat(String(raw.Rating)))) : 4.5,
    reviewCount: raw.ReviewCount ? parseInt(String(raw.ReviewCount)) : 0,
    specs: desc ? desc.split(".").slice(0, 2).map((s: string) => s.trim()).filter(Boolean) : [],
    affiliateUrl,
    campaignId,
    sourceId: sid,
  };
}

async function fetchFromImpactWithRetry(sid: string, cid: string, page: number, header: string): Promise<any[]> {
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Add exponential backoff
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }

      const itemsRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/ItemSearch`, {
        headers: { 
          Accept: "application/json", 
          Authorization: header,
          "User-Agent": "Scrollrr/1.0"
        },
        params: { 
          PageSize: 12, 
          Page: page, 
          QueryString: "*" 
        },
        timeout: API_TIMEOUT
      });

      const items = itemsRes?.data?.Items || itemsRes?.data?.Products || [];
      return items
        .map((p: any) => normalizeProduct(p, sid))
        .filter((p: any) => p && p.imageUrl && p.price > 0);

    } catch (err: any) {
      lastError = err;
      const status = err.response?.status;
      
      // Don't retry on 401/403 (auth issues) or 429 (rate limited)
      if (status === 401 || status === 403 || status === 429) {
        console.warn(`[Impact] Auth/Rate error (${status}) - stopping retries`);
        break;
      }

      // Log each attempt
      console.warn(`[Impact] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err.message);
    }
  }

  console.error(`[Impact] Failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  return [];
}

async function fetchFromImpactAPI(page: number): Promise<any[]> {
  if (!hasImpactCreds) {
    console.warn('[Impact] No credentials available');
    return [];
  }

  try {
    const impactPage = page + 1;
    const partnerRequests = SIDs.map(async (sid, i) => {
      const { header } = getAuth(i);
      
      try {
        // Fetch catalogs with timeout
        const catRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
          headers: { Accept: "application/json", Authorization: header },
          timeout: API_TIMEOUT
        }).catch(() => null);

        if (!catRes?.data?.Catalogs || catRes.data.Catalogs.length === 0) {
          console.warn(`[Impact] No catalogs found for SID ${sid}`);
          return [];
        }

        const cid = catRes.data.Catalogs[0].Id || catRes.data.Catalogs[0].CatalogId;
        
        // Fetch products with retry logic
        return await fetchFromImpactWithRetry(sid, cid, impactPage, header);

      } catch (err) {
        console.error(`[Impact] Catalog fetch error for SID ${sid}:`, err instanceof Error ? err.message : err);
        return [];
      }
    });

    const results = await Promise.race([
      Promise.all(partnerRequests),
      new Promise<any[][]>((_, reject) => 
        setTimeout(() => reject(new Error('API fetch timeout')), 15000)
      )
    ]);

    const products = results.flat().slice(0, 12);
    return products;
  } catch (error) {
    console.error('[Impact] API fetch error:', error instanceof Error ? error.message : error);
    return [];
  }
}

function getCacheKey(page: number): string {
  return `feed:page:${page}`;
}

function getFromMemoryCache(page: number): any[] | null {
  const key = getCacheKey(page);
  const cached = memoryCache[key];
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
    console.log(`[Cache] Memory hit for ${key}`);
    return cached.data;
  }
  
  return null;
}

function setMemoryCache(page: number, data: any[]): void {
  const key = getCacheKey(page);
  memoryCache[key] = { data, timestamp: Date.now() };
  console.log(`[Cache] Memory set for ${key} (${data.length} items)`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const page = parseInt(req.query?.page as string) || 0;

    console.log(`[Feed] Request: page=${page}`);

    // 1. Check memory cache first
    const cachedData = getFromMemoryCache(page);
    if (cachedData && cachedData.length > 0) {
      return res.status(200).json(cachedData);
    }

    // 2. Validate credentials
    if (!hasImpactCreds) {
      console.error('[Feed] Impact.com credentials not configured');
      return res.status(200).json([]);
    }

    // 3. Fetch from Impact.com API
    console.log(`[Feed] Fetching from Impact.com API...`);
    const products = await fetchFromImpactAPI(page);

    if (products && products.length > 0) {
      // Cache the results
      setMemoryCache(page, products);
      console.log(`[Feed] Returning ${products.length} products from Impact.com`);
      return res.status(200).json(products);
    }

    // 4. Return empty if no products (instead of error)
    console.warn(`[Feed] No products for page ${page}`);
    return res.status(200).json([]);

  } catch (error: any) {
    console.error('[Feed] Error:', error instanceof Error ? error.message : error);
    // Always return 200 with empty array to avoid client errors
    return res.status(200).json([]);
  }
}