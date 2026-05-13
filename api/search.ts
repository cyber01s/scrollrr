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
const hasImpactCreds = SIDs.length > 0 && TOKENS.length > 0 && PROGRAM_IDS.length > 0;
const SEARCH_CACHE_TTL = 3600; // 1 hour
const API_TIMEOUT = 4000;
const MAX_RETRIES = 2;

// Log credentials status
if (!hasImpactCreds) {
  console.error('[Search] ⚠️  Missing Impact.com credentials - will not be able to search');
}

// In-memory search result cache
const searchCache: Record<string, { data: any[], timestamp: number }> = {};

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
  
  if (campaignId === "18350" || campaignId === "12108") {
    return null;
  }
  
  const destUrl = String(raw.TrackingUrl || raw.TrackingLink || raw.ProductUrl || raw.Url || "");
  if (!destUrl || destUrl.length < 10) return null;

  let affiliateUrl = destUrl;
  if (raw.TrackingUrl) {
    affiliateUrl = destUrl;
  } else if (sid && !destUrl.includes("/c/") && !destUrl.includes("sjv.io") && !destUrl.includes("impact.com")) {
    affiliateUrl = `https://buybestgear.sjv.io/c/${sid}/${campaignId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${IMPACT_PARTNER_PROPERTY_ID}`;
  }

  const desc = String(raw.Description || "").substring(0, 200);

  return {
    id: String(raw.Id || raw.ProductId || `prod-${Math.random()}`),
    name: String(raw.Name || raw.ProductName || "Product").substring(0, 150),
    category: String(raw.Category || "Search Result").substring(0, 50),
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

async function searchImpactWithRetry(sid: string, cid: string, query: string, header: string): Promise<any[]> {
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
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
          PageSize: 20, 
          Page: 1, 
          QueryString: query 
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
      
      // Don't retry on auth errors or rate limits
      if (status === 401 || status === 403 || status === 429) {
        console.warn(`[Search] Auth/Rate error (${status})`);
        break;
      }

      console.warn(`[Search] Attempt ${attempt + 1}/${MAX_RETRIES} failed:`, err.message);
    }
  }

  console.error(`[Search] Failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  return [];
}

async function searchImpactAPI(query: string): Promise<any[]> {
  if (!hasImpactCreds) {
    console.warn('[Search] No Impact.com credentials');
    return [];
  }

  try {
    const partnerRequests = SIDs.map(async (sid, i) => {
      const { header } = getAuth(i);
      
      try {
        const catRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
          headers: { Accept: "application/json", Authorization: header },
          timeout: API_TIMEOUT
        }).catch(() => null);

        if (!catRes?.data?.Catalogs || catRes.data.Catalogs.length === 0) {
          return [];
        }

        const cid = catRes.data.Catalogs[0].Id || catRes.data.Catalogs[0].CatalogId;
        return await searchImpactWithRetry(sid, cid, query, header);

      } catch (err) {
        console.error(`[Search] Catalog error for SID ${sid}:`, err instanceof Error ? err.message : err);
        return [];
      }
    });

    const results = await Promise.race([
      Promise.all(partnerRequests),
      new Promise<any[][]>((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 12000)
      )
    ]);

    return results.flat().slice(0, 20);
  } catch (error) {
    console.error('[Search] API error:', error instanceof Error ? error.message : error);
    return [];
  }
}

function getCacheKey(query: string): string {
  return `search:${query.toLowerCase()}`;
}

function getFromCache(query: string): any[] | null {
  const key = getCacheKey(query);
  const cached = searchCache[key];
  
  if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL * 1000) {
    console.log(`[Cache] Search hit for "${query}"`);
    return cached.data;
  }
  
  return null;
}

function setCache(query: string, data: any[]): void {
  const key = getCacheKey(query);
  searchCache[key] = { data, timestamp: Date.now() };
  console.log(`[Cache] Search cached for "${query}" (${data.length} results)`);
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
    const searchQuery = (req.query?.q || req.query?.query) as string;

    if (!searchQuery || searchQuery.trim().length === 0) {
      return res.status(200).json([]);
    }

    const cleanQuery = searchQuery.trim();
    console.log(`[Search] Query: "${cleanQuery}"`);

    // 1. Check cache first
    const cachedResults = getFromCache(cleanQuery);
    if (cachedResults && cachedResults.length > 0) {
      return res.status(200).json(cachedResults);
    }

    // 2. Validate credentials
    if (!hasImpactCreds) {
      console.error('[Search] Impact.com credentials not configured');
      return res.status(200).json([]);
    }

    // 3. Search Impact.com API
    console.log(`[Search] Querying Impact.com for "${cleanQuery}"...`);
    const products = await searchImpactAPI(cleanQuery);

    if (products && products.length > 0) {
      setCache(cleanQuery, products);
      console.log(`[Search] Returning ${products.length} results`);
      return res.status(200).json(products);
    }

    // 4. Return empty results
    console.warn(`[Search] No results for "${cleanQuery}"`);
    return res.status(200).json([]);

  } catch (error: any) {
    console.error('[Search] Error:', error instanceof Error ? error.message : error);
    return res.status(200).json([]);
  }
}