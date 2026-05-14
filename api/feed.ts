import { IncomingMessage } from 'http';
import axios from 'axios';
import { Buffer } from 'buffer';

// Upstash Redis
let redis: any = null;
const initRedis = () => {
  if (redis) return redis;
  try {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL || process.env.scrollr_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN || process.env.scrollr_KV_REST_API_TOKEN,
    });
    console.log('[Redis] ✓ Connected to Upstash Redis');
    return redis;
  } catch (err) {
    console.warn('[Redis] Failed to initialize:', err instanceof Error ? err.message : err);
    return null;
  }
};

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

const CATALOG_IDS = (process.env.IMPACT_CATALOG_ID || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const IMPACT_PARTNER_PROPERTY_ID = "6988584";
const hasImpactCreds = SIDs.length > 0 && TOKENS.length > 0 && CATALOG_IDS.length > 0;
const CACHE_TTL = 3600 * 2; // 2 hours cache
const API_TIMEOUT = 4000; // 4 second timeout per request
const MAX_RETRIES = 2;

// How many catalogs to pick per scroll page (out of all configured catalogs)
const CATALOGS_PER_PAGE = 3;

// Log credentials status at startup
if (!hasImpactCreds) {
  console.error('[Impact] ⚠️  CRITICAL: Missing credentials!');
  console.error(`  IMPACT_ACCOUNT_SID: ${SIDs.length > 0 ? '✓ Set' : '✗ Missing'}`);
  console.error(`  IMPACT_AUTH_TOKEN: ${TOKENS.length > 0 ? '✓ Set' : '✗ Missing'}`);
  console.error(`  IMPACT_CATALOG_ID: ${CATALOG_IDS.length > 0 ? `✓ Set (${CATALOG_IDS.length} catalogs)` : '✗ Missing — set IMPACT_CATALOG_ID in Vercel Environment Variables'}`);
  console.error('[Impact] Please set these in Vercel → Settings → Environment Variables');
} else {
  console.log(`[Impact] ✓ Credentials loaded — ${CATALOG_IDS.length} catalog(s) configured`);
}

// ─── Seeded shuffle (LCG) ───────────────────────────────────────────────────
// Deterministic so the same page always returns the same shuffle (cache-safe),
// but every page number produces a completely different ordering.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 17), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 13), 0xac4f3d2b);
    s ^= s >>> 16;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Fallback in-memory cache (for when Redis unavailable)
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
  const campaignId = String(raw.CatalogId || CATALOG_IDS[0] || "");
  
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
      const url = `https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/Items`;
      console.log(`[Impact] Request attempt ${attempt + 1}: ${url}`);
      console.log(`[Impact] Auth header length:`, header.length, `starts with:`, header.substring(0, 10));

      // Add exponential backoff
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      }

      const itemsRes = await axios.get(url, {
        headers: {
          Accept: "application/json",
          Authorization: header,
          "User-Agent": "Scrollrr/1.0"
        },
        params: {
          PageSize: 20,
          Page: page,
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

      console.error(`[Impact] Attempt ${attempt + 1} failed: ${status || 'no status'} - ${err.message}`);
      if (err.response?.data) {
        const data = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data);
        console.error(`[Impact] Error response:`, data.substring(0, 500));
      }
      if (err.response?.headers) {
        console.error(`[Impact] Response headers:`, JSON.stringify(err.response.headers));
      }

      // Don't retry on 401/403 (auth issues) or 429 (rate limited)
      if (status === 401 || status === 403 || status === 429) {
        console.warn(`[Impact] Auth/Rate error (${status}) - stopping retries`);
        break;
      }
    }
  }

  console.error(`[Impact] Failed after ${MAX_RETRIES} attempts:`, lastError?.message);
  return [];
}

async function fetchFromImpactAPI(page: number, seed: number): Promise<any[]> {
  if (!hasImpactCreds) {
    console.warn('[Impact] No credentials available');
    return [];
  }

  const { sid, header } = getAuth(0);

  // Pick a fresh random subset of catalogs for this scroll page.
  // Each page gets a different selection and seed-scoped order.
  const shuffled_catalogs = seededShuffle(CATALOG_IDS, seed ^ (page * 0xdeadbeef));
  const selectedCatalogs = shuffled_catalogs.slice(0, Math.min(CATALOGS_PER_PAGE, CATALOG_IDS.length));
  console.log(`[Impact] Page ${page}, seed ${seed} → using catalogs: [${selectedCatalogs.join(', ')}]`);

  try {
    // Fetch from each selected catalog in parallel.
    // Use a different page offset per catalog so products don't repeat.
    const catalogRequests = selectedCatalogs.map(async (catalogId, i) => {
      // Stagger catalog pages so catalog A gives page 1, B gives page 2, etc.
      // This means every scroll surfaces products from different offsets.
      const catalogPage = Math.floor(page / CATALOGS_PER_PAGE) + 1 + i;
      console.log(`[Impact] Fetching SID=${sid}, CatalogID=${catalogId}, CatalogPage=${catalogPage}`);
      try {
        return await fetchFromImpactWithRetry(sid, catalogId, catalogPage, header);
      } catch (err) {
        console.error(`[Impact] Error for catalog ${catalogId}:`, err instanceof Error ? err.message : err);
        return [];
      }
    });

    const results = await Promise.race([
      Promise.all(catalogRequests),
      new Promise<any[][]>((_, reject) =>
        setTimeout(() => reject(new Error('API fetch timeout')), 15000)
      )
    ]);

    // Merge all results then Fisher-Yates shuffle using page as seed,
    // so the same page always returns the same order (cache-safe) but
    // every page feels completely fresh to the user.
    const merged = results.flat();
    const shuffled = seededShuffle(merged, seed ^ (page * 0x9e3779b9));

    // Return 12 products per scroll page
    const products = shuffled.slice(0, 12);
    console.log(`[Impact] ✓ Returning ${products.length} shuffled products from ${selectedCatalogs.length} catalogs`);
    return products;

  } catch (error) {
    console.error('[Impact] API fetch error:', error instanceof Error ? error.message : error);
    return [];
  }
}

function getCacheKey(page: number, seed: number): string {
  return `feed:s${seed}:p${page}`;
}

async function getFromCache(page: number, seed: number): Promise<any[] | null> {
  const key = getCacheKey(page, seed);
  
  try {
    // Try Redis first
    const redisClient = initRedis();
    if (redisClient) {
      const cached = await redisClient.get(key);
      if (cached) {
        console.log(`[Cache] Redis hit for ${key}`);
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      }
    }
  } catch (err) {
    console.warn('[Cache] Redis get error:', err instanceof Error ? err.message : err);
  }

  // Fallback to memory cache
  const memCached = memoryCache[key];
  if (memCached && Date.now() - memCached.timestamp < CACHE_TTL * 1000) {
    console.log(`[Cache] Memory hit for ${key}`);
    return memCached.data;
  }

  return null;
}

async function setCache(page: number, seed: number, data: any[]): Promise<void> {
  const key = getCacheKey(page, seed);
  
  try {
    // Try Redis first
    const redisClient = initRedis();
    if (redisClient) {
      await redisClient.set(key, JSON.stringify(data), { ex: CACHE_TTL });
      console.log(`[Cache] Redis set for ${key} (${data.length} items, ${CACHE_TTL}s TTL)`);
      return;
    }
  } catch (err) {
    console.warn('[Cache] Redis set error:', err instanceof Error ? err.message : err);
  }

  // Fallback to memory cache
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
    const seed = parseInt(req.query?.seed as string) || Math.floor(Math.random() * 0xffffffff);

    console.log(`[Feed] Request: page=${page}, seed=${seed}`);

    // 1. Check cache (Redis with fallback to memory)
    const cachedData = await getFromCache(page, seed);
    if (cachedData && cachedData.length > 0) {
      return res.status(200).json(cachedData);
    }

    // 2. Validate credentials
    if (!hasImpactCreds) {
      console.error('[Feed] ❌ Impact.com credentials not configured');
      console.error('[Feed] Need to set on Vercel:');
      console.error('[Feed]   - IMPACT_ACCOUNT_SID');
      console.error('[Feed]   - IMPACT_AUTH_TOKEN');
      console.error('[Feed]   - IMPACT_CATALOG_ID');
      console.error('[Feed] Go to: Vercel Dashboard → scrollrr → Settings → Environment Variables');
      return res.status(200).json([]);
    }

    // 3. Fetch from Impact.com API
    console.log(`[Feed] Fetching from Impact.com API...`);
    const products = await fetchFromImpactAPI(page, seed);

    if (products && products.length > 0) {
      // Cache the results (async but don't wait)
      setCache(page, seed, products);
      console.log(`[Feed] ✓ Returning ${products.length} products from Impact.com`);
      return res.status(200).json(products);
    }

    // 4. Return empty if no products (instead of error)
    console.warn(`[Feed] No products returned for page ${page}`);
    return res.status(200).json([]);

  } catch (error: any) {
    console.error('[Feed] Error:', error instanceof Error ? error.message : error);
    // Always return 200 with empty array to avoid client errors
    return res.status(200).json([]);
  }
}