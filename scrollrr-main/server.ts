import { Buffer } from "buffer";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import { getApps, initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit as fsLimit,
  getDocs,
  doc,
  setDoc,
  addDoc
} from "firebase/firestore/lite";
import fs from "fs";
import cors from "cors";
import Redis from "ioredis";
import pg from "pg";
import { GoogleGenAI } from "@google/genai";
const { Pool } = pg;

// Conditionally load dotenv if not on Vercel
if (!process.env.VERCEL && !process.env.VERCEL_URL) {
  dotenv.config();
}

// Ensure Vercel doesn't trip on ESM globals if compiled to CJS
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);


// Redis Client (Upstash) - Using IORedis for standard Redis protocol support
let redis: Redis | null = null;
const possibleRedisUrls = [
  process.env.UPSTASH_REDIS_URL,
  process.env.REDIS_URL,
  process.env.KV_URL,
  ...Object.keys(process.env).filter(k => k.endsWith('_REDIS_URL') || k.endsWith('_KV_URL')).map(k => process.env[k])
].filter(Boolean);

if (possibleRedisUrls.length > 0 || process.env.UPSTASH_REDIS_TOKEN) {
  try {
    let redisUrl = possibleRedisUrls[0] || "";

    
    // Support separate token if URL is just a host
    const token = process.env.UPSTASH_REDIS_TOKEN;
    if (redisUrl && token && !redisUrl.includes(":") && !redisUrl.includes("@")) {
      redisUrl = `rediss://default:${token}@${redisUrl}:6379`;
    } else if (!redisUrl && token) {
      console.warn("[Redis] TOKEN provided but URL missing. Cannot initialize.");
    }

    // Clean URL if client pasted the full redis-cli command from Upstash UI
    if (redisUrl.includes("-u redis://")) {
      redisUrl = redisUrl.split("-u ")[1].trim();
    }
    
    if (redisUrl) {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Allow unlimited retries for connection stability
        connectTimeout: 5000,
        lazyConnect: true,
        enableOfflineQueue: false, // DO NOT QUEUE IF DISCONNECTED
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });

      redis.on("error", (err) => {
        // Shush common "connection closed" errors to keep logs clean during reconnects
        if (!err.message.includes("Connection is closed") && !err.message.includes("ECONNREFUSED")) {
          console.warn("[Redis] Connection error:", err.message);
        }
      });

      redis.on("connect", () => console.log("[Redis] Connected to Upstash."));
      console.log("[Redis] Client initialized.");
    }
  } catch (err) {
    console.error("[Redis] Initialization error:", err);
  }
}

/**
 * Helper to safely check if Redis is ready to use
 */
const isRedisReady = () => {
  return redis && redis.status === "ready";
};

// Infrastructure Clients
let db: any = null;
let pgPool: pg.Pool | null = null;
let infraPromise: Promise<void> | null = null;
let isFirestoreQuotaExceeded = false;
let quotaExceededTime = 0;
const QUOTA_RETRY_DELAY = 1000 * 60 * 60; // 1 hour circuit breaker (be more aggressive)

/**
 * Checks if an error is a Firestore quota/exhaustion error
 */
function isQuotaError(e: any): boolean {
  const msg = (e.message || String(e)).toLowerCase();
  return (
    msg.includes("quota") || 
    msg.includes("exhausted") || 
    msg.includes("limit exceeded") ||
    (e.code === "resource-exhausted")
  );
}

// Firebase Diagnostics
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: { userId: null, email: null }
  };
  console.error('[Firestore Error Details]:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function initInfrastructure() {
  if (infraPromise) return infraPromise;
  
  infraPromise = (async () => {
    console.log("[Infra] Initialization start...");
    
    // 1. Initialize Postgres if URL is present (Preferred)
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
    if (dbUrl) {
      try {
        console.log("[Postgres] Connecting to DB...");
        pgPool = new Pool({
          connectionString: dbUrl,
          ssl: { rejectUnauthorized: false },
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          max: 10
        });

        pgPool.on("error", (err) => {
          console.error("[Postgres] Unexpected pool error:", err.message);
        });
        
        // Test connection and create table
        const client = await pgPool.connect();
        try {
          await client.query(`
            CREATE TABLE IF NOT EXISTS products (
              "id" TEXT PRIMARY KEY,
              "name" TEXT NOT NULL,
              "category" TEXT,
              "imageUrl" TEXT,
              "price" NUMERIC,
              "originalPrice" NUMERIC,
              "currency" TEXT,
              "rating" NUMERIC,
              "reviewCount" INTEGER,
              "specs" TEXT[],
              "affiliateUrl" TEXT,
              "campaignId" TEXT,
              "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
          `);
          console.log("[Postgres] Products table ready.");
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.error("[Postgres] Init error:", err.message);
        pgPool = null;
      }
    }

    // 2. Initialize Firebase (Secondary/Legacy)
    try {
      const rootPath = process.cwd();
      const configPath = path.join(rootPath, "firebase-applet-config.json");
      
      if (fs.existsSync(configPath)) {
        const configRaw = fs.readFileSync(configPath, "utf-8");
        if (configRaw && configRaw.trim()) {
          const firebaseConfig = JSON.parse(configRaw);
          const apps = getApps();
          const firebaseApp = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
          
          db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
          
          console.log(`[Firebase] Initialized (Lite). Apps count: ${apps.length}`);
          syncImpactProducts().catch(e => console.error("[Sync] Background init fail:", e));
        }
      }
    } catch (e: any) {
      console.warn("[Firebase] Init skipped/failed:", e.message);
    }
  })().catch(err => console.error("[Infra] Unhandled top-level error during infra init:", err));

  return infraPromise;
}

// Removed early infra call for Vercel. Handlers will call it lazily.
const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Request tracking
app.use((req: any, res, next) => {
  req.requestId = Math.random().toString(36).substring(7);
  const timestamp = new Date().toISOString();
  if (req.path !== "/api/health") {
    console.log(`[${timestamp}][${req.requestId}] incoming: ${req.method} origUrl=${req.originalUrl} url=${req.url} path=${req.path}`);
  }
  
  // Vercel rewrite compensation if it overwrites req.url
  if (req.url.startsWith("/api/index.ts")) {
     req.url = req.originalUrl || req.url;
  }
  
  next();
});

// Impact.com credentials (REQUIRED)
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
  const originalPrice = raw.OriginalPrice ? parseFloat(String(raw.OriginalPrice)) : null;
  const campaignId = String(raw.CatalogId || PROGRAM_IDS[0] || "1236776");
  
  if (campaignId === "18350" || campaignId === "12108") {
    return null;
  }
  
  const destUrl = String(raw.TrackingUrl || raw.TrackingLink || raw.ProductUrl || raw.Url || "https://www.buybestgear.com");

  let affiliateUrl = destUrl;
  if (sid && !affiliateUrl.includes("/c/") && !affiliateUrl.includes("sjv.io") && !affiliateUrl.includes("impact.com")) {
    affiliateUrl = `https://buybestgear.sjv.io/c/${sid}/${campaignId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${IMPACT_PARTNER_PROPERTY_ID}`;
  }

  const desc = String(raw.Description || "");

  return {
    id: String(raw.Id || raw.ProductId || Math.random().toString(36).substring(7)),
    name: String(raw.Name || raw.ProductName || "Premium Gear"),
    category: String(raw.Category || "Discovery"),
    imageUrl: String(raw.ImageUri || raw.ImageLink || raw.ImageUrl || ""),
    price: isNaN(price) ? 0 : price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
    currency: String(raw.Currency || "USD"),
    rating: raw.Rating ? parseFloat(String(raw.Rating)) : 4.8,
    reviewCount: raw.ReviewCount ? parseInt(String(raw.ReviewCount)) : Math.floor(Math.random() * 2000),
    specs: desc ? desc.split(".").slice(0, 2).map((s: string) => s.trim()).filter(Boolean) : ["High Performance", "Minimalist Design"],
    affiliateUrl,
    campaignId,
  };
}

let isSyncing = false;
async function syncImpactProducts() {
  if ((!db && !pgPool) || !hasImpactCreds || isSyncing) return;
  isSyncing = true;
  console.log("[Sync] Triggered background catalog update...");

  try {
    for (let i = 0; i < SIDs.length; i++) {
      const { sid, header } = getAuth(i);
      const catRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
        headers: { Accept: "application/json", Authorization: header },
        timeout: 5000
      }).catch(() => null);

      if (!catRes?.data?.Catalogs) continue;
      
      const catalogs = catRes.data.Catalogs;
      const activeCatalogs = (catalogs as any[]).slice(0, 2); // Only sync 2 catalogs to keep it fast

      for (const cat of activeCatalogs) {
        const cid = cat.Id || cat.CatalogId;
        if (!cid) continue;

        const itemsRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/ItemSearch`, {
          headers: { Accept: "application/json", Authorization: header },
          params: { PageSize: 50, Page: 1, QueryString: "*" },
          timeout: 8000
        }).catch(() => null);

        if (!itemsRes?.data) continue;
        const items = itemsRes.data.Items || itemsRes.data.Products || [];

        for (const raw of items) {
          if (isFirestoreQuotaExceeded && (Date.now() - quotaExceededTime < QUOTA_RETRY_DELAY)) {
            console.warn("[Sync] Firestore quota exceeded. Stopping background sync.");
            return;
          }

          const p = normalizeProduct(raw, sid);
          if (!p || !p.imageUrl || p.price === 0) continue;

          // Save to Postgres (Primary)
          if (pgPool) {
            try {
              await pgPool.query(
                `INSERT INTO products (
                  "id", "name", "category", "imageUrl", "price", "originalPrice", "currency", "rating", "reviewCount", "specs", "affiliateUrl", "campaignId", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
                ON CONFLICT ("id") DO UPDATE SET
                  "name" = EXCLUDED."name",
                  "category" = EXCLUDED."category",
                  "imageUrl" = EXCLUDED."imageUrl",
                  "price" = EXCLUDED."price",
                  "originalPrice" = EXCLUDED."originalPrice",
                  "currency" = EXCLUDED."currency",
                  "rating" = EXCLUDED."rating",
                  "reviewCount" = EXCLUDED."reviewCount",
                  "specs" = EXCLUDED."specs",
                  "affiliateUrl" = EXCLUDED."affiliateUrl",
                  "campaignId" = EXCLUDED."campaignId",
                  "updatedAt" = NOW()`,
                [
                  p.id, p.name, p.category, p.imageUrl, p.price, p.originalPrice, 
                  p.currency, p.rating, p.reviewCount, p.specs, p.affiliateUrl, p.campaignId
                ]
              );
            } catch (pgErr: any) {
              console.error(`[Sync] Postgres save error for ${p.id}:`, pgErr.message);
            }
          }

          // Save to Firestore (Secondary)
          if (db) {
            await setDoc(doc(db, "products", p.id), p, { merge: true }).catch((err) => {
              if (isQuotaError(err)) {
                isFirestoreQuotaExceeded = true;
                quotaExceededTime = Date.now();
                console.error("[CircuitBreaker] Quota exceeded during sync.");
              }
              if (err.message?.includes("permissions")) {
                handleFirestoreError(err, OperationType.WRITE, `products/${p.id}`);
              }
            });
          }
        }
      }
    }
    console.log("[Sync] Completed.");
  } catch (e: any) {
    console.error("[Sync] Failed:", e.message);
  } finally {
    isSyncing = false;
  }
}

// Standardize feed error handling
const feedHandler = async (req: express.Request, res: express.Response) => {
  const page = parseInt(req.query.page as string) || 0;
  const requestId = (req as any).requestId || Math.random().toString(36).substring(7);
  console.log(`[Feed][${requestId}] Request start: page=${page}`);

  let isResponseSent = false;
  const startTime = Date.now();

  // Global safety timeout (8s to stay well under Vercel's 10s limit)
  const timeoutId = setTimeout(() => {
    if (!isResponseSent) {
      isResponseSent = true;
      console.warn(`[Feed][${requestId}] TIMEOUT triggered after 8s. Falling back to mock data.`);
      res.json(generateMockProducts(12, page));
    }
  }, 8000);

  try {
    console.log(`[Feed][${requestId}] Starting feed request for page ${page}`);
    
    // 0. CHECK REDIS FIRST (Reduce hits to Firestore/Impact)
    if (isRedisReady()) {
      try {
        const cacheKey = `feed:v6:page:${page}`;
        const cachedResultsRaw = await redis!.get(cacheKey);
        if (cachedResultsRaw) {
          const cachedResults = JSON.parse(cachedResultsRaw);
          if (Array.isArray(cachedResults) && cachedResults.length > 0) {
            isResponseSent = true;
            clearTimeout(timeoutId);
            console.log(`[Feed][${requestId}] Success from REDIS (${cachedResults.length} items, took ${Date.now() - startTime}ms)`);
            return res.json(cachedResults);
          }
        }
      } catch (redisErr: any) {
        if (!redisErr.message?.includes("closed")) {
          console.warn(`[Feed][${requestId}] Redis read error:`, redisErr.message);
        }
      }
    }

    // 1. Lazy infra init (with better error handling)
    try {
      await Promise.race([
        initInfrastructure(),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]).catch(e => console.warn(`[Feed][${requestId}] Infra init warning (non-fatal):`, e));
    } catch (infraError: any) {
      console.warn(`[Feed][${requestId}] Infra init failed (continuing with fallbacks):`, infraError.message);
    }

    // 2. Try Postgres (Primary)
    if (pgPool) {
      try {
        console.log(`[Feed][${requestId}] Checking Postgres...`);
        const start = page * 12;
        const resPg = await pgPool.query(`SELECT * FROM products ORDER BY "id" LIMIT 12 OFFSET $1`, [start]);
        
        if (resPg.rows.length > 0 && !isResponseSent) {
          const products = resPg.rows.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            imageUrl: r.image_url || r.imageUrl || r.imageurl || "",
            price: parseFloat(r.price),
            originalPrice: (r.original_price || r.originalPrice || r.originalprice) ? parseFloat(r.original_price || r.originalPrice || r.originalprice) : null,
            currency: r.currency || "USD",
            rating: parseFloat(r.rating || r.Rating || "4.8"),
            reviewCount: r.review_count || r.reviewCount || r.reviewcount || 0,
            specs: r.specs || [],
            affiliateUrl: r.affiliate_url || r.affiliateUrl || r.affiliateurl || "",
            campaignId: r.campaign_id || r.campaignId || r.campaignid || ""
          }));

          // Cache the results in Redis
          if (isRedisReady()) {
            try {
              const cacheKey = `feed:v6:page:${page}`;
              await redis!.set(cacheKey, JSON.stringify(products), "EX", 3600 * 6);
            } catch (e: any) {}
          }

          isResponseSent = true;
          clearTimeout(timeoutId);
          console.log(`[Feed][${requestId}] Success from Postgres (${products.length} items)`);
          return res.json(products);
        }
      } catch (err: any) {
        console.warn(`[Feed][${requestId}] Postgres fail:`, err.message);
      }
    }

    // 3. Try Firestore (Secondary)
    const now = Date.now();
    const canUseFirestore = db && (!isFirestoreQuotaExceeded || (now - quotaExceededTime > QUOTA_RETRY_DELAY));

    if (canUseFirestore) {
      try {
        console.log(`[Feed][${requestId}] Checking Firestore...`);
        const q = query(collection(db, "products"), orderBy("id"), fsLimit(60)); // Get more to allow pagination
        const snapshot = await getDocs(q);
        const allProducts = snapshot.docs.map(doc => doc.data());
        
        // Reset quota flag if successful
        if (isFirestoreQuotaExceeded) {
          isFirestoreQuotaExceeded = false;
          console.log(`[Feed][${requestId}] Firestore quota seems recovered.`);
        }

        const start = page * 12;
        const paged = allProducts.slice(start, start + 12);
        
        if (paged.length > 0 && !isResponseSent) {
          // Cache the results in Redis for future requests
          if (isRedisReady()) {
            try {
              const cacheKey = `feed:v6:page:${page}`;
              // Cache longer if Firestore is failing
              const ttl = isFirestoreQuotaExceeded ? 3600 * 24 : 3600 * 6;
              await redis!.set(cacheKey, JSON.stringify(paged), "EX", ttl);
              console.log(`[Feed][${requestId}] Cached results in REDIS for ${cacheKey} (TTL: ${ttl}s)`);
            } catch (e: any) {
              console.warn(`[Feed][${requestId}] Redis write fail:`, e.message);
            }
          }

          isResponseSent = true;
          clearTimeout(timeoutId);
          console.log(`[Feed][${requestId}] Success from Firestore (${paged.length} items, took ${Date.now() - startTime}ms)`);
          return res.json(paged);
        }
      } catch (e: any) {
        const errorMsg = e.message || String(e);
        console.warn(`[Feed][${requestId}] Firestore fail:`, errorMsg);
        if (isQuotaError(e)) {
          isFirestoreQuotaExceeded = true;
          quotaExceededTime = Date.now();
          console.error(`[CircuitBreaker!!!] Firestore quota exceeded. Silencing for ${QUOTA_RETRY_DELAY / 3600000} hours. Error: ${errorMsg}`);
        }
      }
    } else if (isFirestoreQuotaExceeded) {
      console.log(`[Feed][${requestId}] Skipping Firestore (Circuit breaker active)`);
    }

    // 4. Try Impact API
    if (hasImpactCreds) {
      try {
        const impactPage = page + 1;
        const partnerRequests = SIDs.map(async (sid, i) => {
          const { header } = getAuth(i);
          const catRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
            headers: { Accept: "application/json", Authorization: header },
            timeout: 3000
          }).catch(() => null);

          const catalogs = catRes?.data?.Catalogs || [];
          if (catalogs.length === 0) return [];
          
          const cid = catalogs[0].Id || catalogs[0].CatalogId;
          const itemsRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/ItemSearch`, {
            headers: { Accept: "application/json", Authorization: header },
            params: { PageSize: 12, Page: impactPage, QueryString: "*" },
            timeout: 4000
          }).catch(() => null);

          const items = itemsRes?.data?.Items || itemsRes?.data?.Products || [];
          return items.map((p: any) => normalizeProduct(p, sid)).filter((p: any) => p && p.imageUrl && p.price > 0);
        });

        const results = await Promise.all(partnerRequests);
        const products = results.flat();
        if (products.length > 0 && !isResponseSent) {
          // Cache the results in Redis
          if (isRedisReady()) {
            try {
              const cacheKey = `feed:v6:page:${page}`;
              await redis!.set(cacheKey, JSON.stringify(products), "EX", 3600 * 2); // Cache for 2 hours
            } catch (e: any) {
              console.warn(`[Feed][${requestId}] Redis write fail:`, e.message);
            }
          }

          isResponseSent = true;
          clearTimeout(timeoutId);
          console.log(`[Feed][${requestId}] Success: Impact (${products.length} items)`);
          return res.json(products);
        }
      } catch (e: any) {
        console.warn(`[Feed][${requestId}] Impact API error:`, e.message);
      }
    }

    // 5. Default Fallback
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(timeoutId);
      console.log(`[Feed][${requestId}] Returning mock products (final fallback)`);
      return res.json(generateMockProducts(12, page));
    }

  } catch (err: any) {
    console.error(`[Feed][${requestId}] TOP LEVEL ERROR:`, err.stack || err.message || err);
    if (!isResponseSent) {
      isResponseSent = true;
      clearTimeout(timeoutId);
      console.log(`[Feed][${requestId}] Returning mock data due to error`);
      return res.json(generateMockProducts(12, page));
    }
  }
};


const searchHandler = async (req: express.Request, res: express.Response) => {
  const requestId = (req as any).requestId || Math.random().toString(36).substring(7);
  try {
    const searchQuery = req.query.q as string;
    if (!searchQuery) return res.json([]);

    const startTime = Date.now();

    // 0. CHECK REDIS CACHE FOR THIS SEARCH
    if (isRedisReady()) {
      try {
        const cacheKey = `search:v3:q:${searchQuery.toLowerCase()}`;
        const cachedResultsRaw = await redis!.get(cacheKey);
        if (cachedResultsRaw) {
          const cachedResults = JSON.parse(cachedResultsRaw);
          if (Array.isArray(cachedResults)) {
            console.log(`[Search][${requestId}] Success from REDIS (${cachedResults.length} items, took ${Date.now() - startTime}ms)`);
            return res.json(cachedResults);
          }
        }
      } catch (redisErr: any) {
        if (!redisErr.message?.includes("closed")) {
          console.warn(`[Search][${requestId}] Redis read error:`, redisErr.message);
        }
      }
    }

    await Promise.race([
      initInfrastructure(),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]).catch(() => {});

    // 1. Try Postgres (Primary)
    if (pgPool) {
      try {
        console.log(`[Search][${requestId}] Checking Postgres...`);
        const searchRes = await pgPool.query(
          `SELECT * FROM products 
           WHERE ("name" ILIKE $1 OR "category" ILIKE $1 OR EXISTS (
             SELECT 1 FROM unnest("specs") s WHERE s ILIKE $1
           )) LIMIT 20`,
          [`%${searchQuery}%`]
        );

        if (searchRes.rows.length > 0) {
          const products = searchRes.rows.map(r => ({
            id: r.id,
            name: r.name,
            category: r.category,
            imageUrl: r.image_url || r.imageUrl || r.imageurl || "",
            price: parseFloat(r.price),
            originalPrice: (r.original_price || r.originalPrice || r.originalprice) ? parseFloat(r.original_price || r.originalPrice || r.originalprice) : null,
            currency: r.currency || "USD",
            rating: parseFloat(r.rating || r.Rating || "4.8"),
            reviewCount: r.review_count || r.reviewCount || r.reviewcount || 0,
            specs: r.specs || [],
            affiliateUrl: r.affiliate_url || r.affiliateUrl || r.affiliateurl || "",
            campaignId: r.campaign_id || r.campaignId || r.campaignid || ""
          }));

          if (isRedisReady()) {
            try {
              const cacheKey = `search:v6:q:${searchQuery.toLowerCase()}`;
              await redis!.set(cacheKey, JSON.stringify(products), "EX", 3600);
            } catch (e: any) {}
          }
          console.log(`[Search][${requestId}] Success from Postgres (${products.length} items)`);
          return res.json(products);
        }
      } catch (err: any) {
        console.warn(`[Search][${requestId}] Postgres fail:`, err.message);
      }
    }

    // 2. Try Firestore (Secondary)
    const now = Date.now();
    const canUseFirestore = db && (!isFirestoreQuotaExceeded || (now - quotaExceededTime > QUOTA_RETRY_DELAY));

    if (canUseFirestore) {
      try {
        console.log(`[Search][${requestId}] Checking Firestore...`);
        const q = query(collection(db, "products"), fsLimit(200));
        const snapshot = await getDocs(q).catch(e => {
          const errorMsg = e.message || String(e);
          if (errorMsg.includes("permissions")) {
            handleFirestoreError(e, OperationType.LIST, "products");
          }
          if (isQuotaError(e)) {
             isFirestoreQuotaExceeded = true;
             quotaExceededTime = Date.now();
             console.error(`[CircuitBreaker!!!] Firestore quota exceeded during search. Error: ${errorMsg}`);
          }
          throw e;
        });
        let products = snapshot.docs.map(doc => doc.data() as any);
        products = products.filter(p => 
          (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.specs && JSON.stringify(p.specs).toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 20);

        if (products.length > 0) {
          if (isRedisReady()) {
            try {
              const cacheKey = `search:v6:q:${searchQuery.toLowerCase()}`;
              await redis!.set(cacheKey, JSON.stringify(products), "EX", 3600); // Cache for 1 hour
            } catch (e: any) {
              console.warn(`[Search][${requestId}] Redis write fail:`, e.message);
            }
          }
          console.log(`[Search][${requestId}] Success from Firestore (${products.length} items, took ${Date.now() - startTime}ms)`);
          return res.json(products);
        }
      } catch (e) {}
    }

    if (hasImpactCreds) {
      console.log(`[Search][${requestId}] Falling back to Impact API...`);
      const partnerRequests = SIDs.map(async (rawSid, index) => {
        const { sid, header } = getAuth(index);
        try {
          const catResponse = await axios.get(
            `https://api.impact.com/Mediapartners/${sid}/Catalogs/`,
            {
              headers: { Accept: "application/json", Authorization: header },
              timeout: 4000,
            },
          );
          const catalogs = catResponse.data.Catalogs || [];

          const cids = (catalogs as any[])
            .slice(0, 3)
            .map((c) => c.Id || c.CatalogId)
            .filter(Boolean);
          if (cids.length === 0) cids.push("");

          const searchPromises = cids.map((cid) =>
            axios
              .get(
                `https://api.impact.com/Mediapartners/${sid}/Catalogs/ItemSearch`,
                {
                  headers: {
                    Accept: "application/json",
                    Authorization: header,
                  },
                  params: {
                    QueryString: searchQuery,
                    PageSize: 10,
                    Page: 1,
                    ...(cid ? { CatalogId: cid } : {}),
                  },
                  timeout: 5000,
                },
              )
              .catch(() => null),
          );

          const responses = await Promise.all(searchPromises);
          const allItems = responses.flatMap((r) => {
            if (!r || !r.data || r.data.Status === "ERROR") return [];
            return (r.data.Items || r.data.Products || []).map((p: any) =>
              normalizeProduct(p, sid),
            );
          });

          return allItems;
        } catch (e: any) {
          return [];
        }
      });

      const results = await Promise.all(partnerRequests);
      const products = results.flat();
      
      if (products.length > 0 && isRedisReady()) {
        try {
          const cacheKey = `search:v3:q:${searchQuery.toLowerCase()}`;
          await redis!.set(cacheKey, JSON.stringify(products), "EX", 3600);
        } catch (e: any) {
          console.warn(`[Search][${requestId}] Redis write fail:`, e.message);
        }
      }

      return res.json(products);
    }

    const products = generateMockProducts(10, 0).filter(
      (p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    res.json(products);
  } catch (error) {
    res.json([]);
  }
};

const specsHandler = async (req: express.Request, res: express.Response) => {
  try {
    const { name, category } = req.query;
    if (!name) return res.status(400).json({ error: "Name required" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "No API key available" });
    }

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `You are a gear expert. Summarize the key specifications, materials, or features of this product in exactly 3 short bullet points (max 5 words each). Product Name: ${name}. Category: ${category || 'Unknown'}. Return ONLY a JSON array of 3 strings. Example: ["Carbon steel", "Waterproof", "Lightweight"]`;
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    const text = response.text || "";
    let specs = ["Premium Quality", "Durable Build", "High Performance"];
    
    try {
      const match = text.match(/\[.*\]/s);
      if (match) {
        specs = JSON.parse(match[0]);
      } else {
        specs = JSON.parse(text);
      }
    } catch (e) {
      console.error("Failed to parse Gemini response:", text);
    }
    
    res.json(specs);
  } catch (error) {
    console.error("AI Analysis error:", error);
    res.status(500).json({ error: "AI Analysis failed" });
  }
};

const imageHandler = async (req: express.Request, res: express.Response) => {
  try {
    await Promise.race([
      initInfrastructure(),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]).catch(() => {});

    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL required");

    // Simplified image analysis for reliability
    return res.json({
      hasBg: true,
      dominantColor: "rgb(20, 20, 20)",
      aspectRatio: 1
    });
  } catch (error) {
    res.status(500).json({ error: "Image processing unavailable" });
  }
};

const trackHandler = async (req: express.Request, res: express.Response) => {
  await initInfrastructure();
  const { productId, source, sessionId } = req.body;
  console.log("Tracking click:", req.body);

  if (db) {
    try {
      await addDoc(collection(db, "click_tracking"), {
        product_id: productId,
        source: source,
        session_id: sessionId || null,
        created_at: new Date().toISOString()
      }).catch(err => {
        if (err.message?.includes("permissions")) {
          handleFirestoreError(err, OperationType.CREATE, "click_tracking");
        }
        throw err;
      });
    } catch (err) {
      console.error("Tracking db error:", err);
    }
  }

  res.status(202).send();
};

// Health check and environment debug
const healthHandler = (req: express.Request, res: express.Response) => {
  res.json({ 
    status: "ok", 
    vercel: !!(process.env.VERCEL || process.env.VERCEL_URL),
    env: process.env.NODE_ENV,
    creds: hasImpactCreds,
    db: !!db,
    time: new Date().toISOString(),
    path: req.path
  });
};

const statusHandler = async (req: express.Request, res: express.Response) => {
  await initInfrastructure();
  res.json({
    status: "online",
    database: db ? "connected" : "disconnected",
    partners: SIDs.length,
    timestamp: new Date().toISOString(),
    env: {
      IMPACT_SID: SIDs.length > 0 ? "Set" : "Not Set",
      IMPACT_TOKEN: TOKENS.length > 0 ? "Set" : "Not Set"
    }
  });
};

app.get("/api/health", healthHandler);
app.get("/api/status", statusHandler);
app.get("/api/ping", (req, res) => res.send("pong"));
app.get("/health", healthHandler); 

app.get("/api/feed", feedHandler);
app.get("/feed", feedHandler); // Robustness for Vercel path stripping

app.get("/api/search", searchHandler);
app.get("/search", searchHandler);

app.get("/api/specs", specsHandler);
app.get("/specs", specsHandler);

app.get("/api/image", imageHandler);
app.get("/image", imageHandler);

app.post("/api/track", trackHandler);
app.post("/track", trackHandler);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("GLOBAL SERVER ERROR:", err);
  res.status(500).json({
    error: "SCROLLR_EXPRESS_ERROR",
    message: err.message || "Unknown error occurred",
    path: req.path
  });
});

// Force JSON for all /api routes and provide a 404 if not matched
app.all("/api/*", (req, res) => {
  console.log(`[404] API Route Not Found: ${req.url}`);
  res.status(404).json({ error: `API route ${req.url} not found` });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving logic
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Only auto-start if not running as a Vercel serverless function
if (!process.env.VERCEL && !process.env.VERCEL_URL) {
  console.log(`[Server] Starting in ${process.env.NODE_ENV || 'development'} mode...`);
  startServer().catch(err => {
    console.error("[Server] Critical startup error:", err);
    process.exit(1);
  });
}

export default app;

function generateMockProducts(count: number, page: number): any[] {
  const categories = [
    "Audio",
    "Tech",
    "Gaming",
    "Cameras",
    "Home",
    "Fitness",
    "Outdoor",
  ];
  const images = [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1610438235354-a6ae5528385c?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=1000"
  ];

  return Array.from({ length: count }).map((_, i) => {
    const id = `mock-${page}-${i}`;
    const name = `Premium ${categories[i % categories.length]} Gear ${i + page * 20}`;
    const category = categories[i % categories.length].toUpperCase();
    const imageUrl = images[i % images.length];
    const price = Math.floor(Math.random() * 500) + 99;

    const campaignId = "1236776";
    const actionId = "15219";
    const partnerId = "6988584";
    const destUrl = `https://www.buybestgear.com/products/${id}`;
    const affiliateUrl = `https://buybestgear.sjv.io/c/6183063/${campaignId}/${actionId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${partnerId}`;

    return {
      id,
      name,
      category,
      imageUrl,
      price,
      originalPrice: Math.random() > 0.5 ? price + 100 : null,
      currency: "USD",
      rating: parseFloat((Math.random() * 1 + 4).toFixed(1)),
      reviewCount: Math.floor(Math.random() * 5000),
      specs: ["Pro Performance", "Sleek Design"],
      affiliateUrl,
    };
  });
}
