import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit as fsLimit,
  getCountFromServer,
  where
} from "firebase/firestore";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Infrastructure Clients
let redis: any = null;
let db: any = null;

async function initInfrastructure() {
  console.log("Initializing Infrastructure...");
  const rawRedisUrl = process.env.REDIS_URL || "";
  const parsedRedisUrl = rawRedisUrl.match(/redis(?:s)?:\/\/[^\s]+/)?.[0] || rawRedisUrl;

  if (parsedRedisUrl) {
    try {
      const { default: Redis } = await import("ioredis");
      const redisOpts: any = { maxRetriesPerRequest: 3 };
      if (parsedRedisUrl.includes("upstash.io") || parsedRedisUrl.startsWith("rediss://")) {
        redisOpts.tls = { rejectUnauthorized: false };
      }
      redis = new Redis(parsedRedisUrl, redisOpts);
      redis.on("error", (err: any) => console.error("Redis error:", err));
      console.log("Redis initialized");
    } catch (e) {
      console.error("Redis init failed (non-critical):", e);
    }
  }

  // Firebase Init
  try {
    const configPaths = [
      path.join(process.cwd(), "firebase-applet-config.json"),
      path.join(__dirname, "firebase-applet-config.json"),
      "./firebase-applet-config.json"
    ];
    let configPath = configPaths.find(p => fs.existsSync(p));
    
    if (configPath) {
      console.log("Loading Firebase config from:", configPath);
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const firebaseApp = initializeApp(firebaseConfig);
      db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
      console.log("Firebase Firestore initialized successfully.");
    } else {
      console.warn("No firebase-applet-config.json found - proceeding with live/mock fallback.");
    }
  } catch (e) {
    console.error("Firebase init failed (non-critical):", e);
  }
}

// Global promise to track infra readiness
const infraReady = initInfrastructure();

const app = express();
const PORT = 3000;

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} -> ${req.path}`);
  next();
});

app.use(express.json());

// Expose app for Vercel
// Moving to bottom to ensure all routes are registered

// Impact.com credentials (REQUIRED)
// Support comma-separated SIDs/Tokens for "all partners" request
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

// Optional/Configurable
const IMPACT_ACTION_ID = "15219";
const IMPACT_PARTNER_PROPERTY_ID = "6988584";

const hasImpactCreds = SIDs.length > 0 && TOKENS.length > 0;

function getAuth(index: number) {
  let sid = SIDs[index] || SIDs[0];
  let token = TOKENS[index] || TOKENS[0];
  // Auto-swap if they accidentally put the Token in the SID field
  if (sid && token && sid.length > 20 && token.length < 15) {
    const temp = sid;
    sid = token;
    token = temp;
  }
  return {
    sid,
    token,
    header: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
  };
}

function normalizeProduct(raw: any, sid: string) {
  const price = parseFloat(raw.Price || raw.CurrentPrice || "0");
  const originalPrice = raw.OriginalPrice
    ? parseFloat(raw.OriginalPrice)
    : null;

  const campaignId = raw.CatalogId || PROGRAM_IDS[0] || "1236776";
  const actionId = IMPACT_ACTION_ID;

  // Use the tracking URL if provided, otherwise manually construct
  const destUrl =
    raw.TrackingUrl ||
    raw.TrackingLink ||
    raw.ProductUrl ||
    raw.Url ||
    "https://www.buybestgear.com";

  let affiliateUrl = destUrl;
  if (
    !affiliateUrl.includes("/c/") &&
    !affiliateUrl.includes("sjv.io") &&
    !affiliateUrl.includes("impact.com")
  ) {
    affiliateUrl = `https://buybestgear.sjv.io/c/${sid}/${campaignId}?u=${encodeURIComponent(destUrl)}&partnerpropertyid=${IMPACT_PARTNER_PROPERTY_ID}`;
  }

  return {
    id: String(
      raw.Id || raw.ProductId || Math.random().toString(36).substring(7),
    ),
    name: String(raw.Name || raw.ProductName || "Premium Gear"),
    category: String(raw.Category || "Discovery"),
    imageUrl: String(raw.ImageUri || raw.ImageLink || raw.ImageUrl || ""),
    price,
    originalPrice:
      originalPrice && originalPrice > price ? originalPrice : null,
    currency: String(raw.Currency || "USD"),
    rating: raw.Rating ? parseFloat(raw.Rating) : 4.8,
    reviewCount: raw.ReviewCount
      ? parseInt(raw.ReviewCount)
      : Math.floor(Math.random() * 2000),
    specs: raw.Description
      ? raw.Description.split(".")
          .slice(0, 2)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ["High Performance", "Minimalist Design"],
    affiliateUrl,
    campaignId,
  };
}

let isSyncing = false;
async function syncImpactProducts() {
  if (!db || !hasImpactCreds || isSyncing) return;
  isSyncing = true;
  console.log("Background Sync: Fetching products from Impact API...");

  try {
    for (let i = 0; i < SIDs.length; i++) {
      const { sid, header } = getAuth(i);
      const catRes = await axios
        .get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
          headers: { Accept: "application/json", Authorization: header },
        })
        .catch(() => null);

      if (!catRes || !catRes.data || !catRes.data.Catalogs) continue;
      const catalogs = catRes.data.Catalogs;
      const activeCatalogs = (catalogs as any[])
        .sort(() => Math.random() - 0.5)
        .slice(0, 5);

      for (const cat of activeCatalogs) {
        const cid = cat.Id || cat.CatalogId;
        if (!cid) continue;

        let itemsRes = await axios
          .get(
            `https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/Items`,
            {
              headers: { Accept: "application/json", Authorization: header },
              params: { PageSize: 50, Page: 1 },
            },
          )
          .catch(() => null);

        if (!itemsRes) {
          itemsRes = await axios
            .get(
              `https://api.impact.com/Mediapartners/${sid}/Catalogs/ItemSearch`,
              {
                headers: {
                  Accept: "application/json",
                  Authorization: header,
                },
                params: {
                  CatalogId: cid,
                  PageSize: 50,
                  Page: 1,
                  QueryString: "*",
                },
              },
            )
            .catch(() => null);
        }

        if (!itemsRes || !itemsRes.data) continue;
        const items = itemsRes.data.Items || itemsRes.data.Products || [];

        for (const raw of items) {
          const p = normalizeProduct(raw, sid);
          if (!p.imageUrl || p.price === 0) continue; // Skip bad data

          await setDoc(doc(db, "products", p.id), {
            id: p.id,
            name: p.name,
            category: p.category,
            imageUrl: p.imageUrl,
            price: p.price,
            originalPrice: p.originalPrice,
            currency: p.currency,
            rating: p.rating,
            reviewCount: p.reviewCount,
            specs: p.specs,
            affiliateUrl: p.affiliateUrl,
            campaignId: p.campaignId,
          }, { merge: true }).catch(() => {});
        }
      }
    }
    console.log("Background Sync: Completed");
  } catch (e: any) {
    console.error("Background Sync: Failed", e.message);
  } finally {
    isSyncing = false;
  }
}

// API Routes
const feedHandler = async (req: express.Request, res: express.Response) => {
  const page = parseInt(req.query.page as string) || 0;
  console.log(`[FeedHandler] Request start: page=${page}`);

  try {
    // 1. Give infrastructure a moment to initialize on first request
    // We don't await indefinitely to avoid timeouts
    if (page === 0) {
      await Promise.race([infraReady, new Promise(r => setTimeout(r, 1000))]).catch(() => {});
    }

    // 2. Try Firestore
    if (db) {
      try {
        const statsDoc = await getCountFromServer(collection(db, "products")).catch(() => null);
        const count = statsDoc?.data().count || 0;
        
        if (count < 50) {
          syncImpactProducts().catch(e => console.error("Background sync fail:", e));
        }

        if (count > 0) {
          const pageSize = 10;
          const q = query(collection(db, "products"), orderBy("id"), fsLimit(pageSize * (page + 1)));
          const snapshot = await getDocs(q);
          const products = snapshot.docs.map(doc => doc.data());
          
          const start = page * pageSize;
          const pagedProducts = products.slice(start, start + pageSize);
          
          if (pagedProducts && pagedProducts.length > 0) {
            console.log(`[FeedHandler] Returning ${pagedProducts.length} from DB`);
            return res.json(pagedProducts);
          }
        }
      } catch (dbError: any) {
        console.error("[FeedHandler] Firestore error (falling back):", dbError.message);
      }
    }

    // 3. Try Impact API
    if (hasImpactCreds) {
      try {
        const impactPage = page + 1;
        const partnerRequests = SIDs.map(async (sid, i) => {
          const { header } = getAuth(i);
          try {
            const catRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/`, {
              headers: { Accept: "application/json", Authorization: header },
              timeout: 3000,
            }).catch(() => null);

            const cid = catRes?.data?.Catalogs?.[0]?.Id || catRes?.data?.Catalogs?.[0]?.CatalogId;
            if (!cid) return [];

            const itemsRes = await axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/${cid}/Items`, {
              headers: { Accept: "application/json", Authorization: header },
              params: { PageSize: 10, Page: impactPage },
              timeout: 4000,
            }).catch(async () => {
               return axios.get(`https://api.impact.com/Mediapartners/${sid}/Catalogs/ItemSearch`, {
                headers: { Accept: "application/json", Authorization: header },
                params: { CatalogId: cid, PageSize: 10, Page: impactPage, QueryString: "*" },
                timeout: 4000,
              }).catch(() => null);
            });

            const items = itemsRes?.data?.Items || itemsRes?.data?.Products || [];
            return items.map((p: any) => normalizeProduct(p, sid)).filter((p: any) => p.imageUrl && p.price > 0);
          } catch (e) { return []; }
        });

        const results = await Promise.all(partnerRequests);
        const products = results.flat();
        if (products.length > 0) {
          console.log(`[FeedHandler] Returning ${products.length} from Impact`);
          return res.json(products);
        }
      } catch (apiError: any) {
        console.error("[FeedHandler] Impact API error (falling back):", apiError.message);
      }
    }

    // 4. Guaranteed Mock Fallback
    console.log(`[FeedHandler] Guaranteed Mock Fallback for page ${page}`);
    return res.json(generateMockProducts(10, page));

  } catch (error: any) {
    console.error("FATAL FEED HANDLER ERROR:", error);
    try {
      return res.json(generateMockProducts(10, page));
    } catch (finalError) {
      return res.status(500).json({ error: "Total System Failure", details: error.message });
    }
  }
};

const searchHandler = async (req: express.Request, res: express.Response) => {
  try {
    const searchQuery = req.query.q as string;
    if (!searchQuery) return res.json([]);

    if (db) {
      try {
        const q = query(collection(db, "products"), fsLimit(200));
        const snapshot = await getDocs(q);
        let products = snapshot.docs.map(doc => doc.data() as any);
        products = products.filter(p => 
          (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (p.specs && JSON.stringify(p.specs).toLowerCase().includes(searchQuery.toLowerCase()))
        ).slice(0, 20);

        if (products.length > 0) {
          return res.json(products);
        }
      } catch (e) {}
    }

    if (hasImpactCreds) {
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

const imageHandler = async (req: express.Request, res: express.Response) => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) return res.status(400).send("URL required");

    const imgCacheKey = `img:meta:${Buffer.from(imageUrl).toString("base64").substring(0, 100)}`;
    if (redis) {
      const cached = await redis.get(imgCacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
    });
    const buffer = Buffer.from(response.data, "binary");

    const { default: sharp } = await import("sharp");
    const image = sharp(buffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    const dominant = stats.channels.map((c) => Math.round(c.mean));
    const isWhiteBg = dominant.every((v) => v > 240);

    const result = {
      hasBg: !isWhiteBg,
      dominantColor: `rgb(${dominant[0]}, ${dominant[1]}, ${dominant[2]})`,
      aspectRatio: (metadata.width || 1) / (metadata.height || 1),
    };

    if (redis)
      await redis.set(imgCacheKey, JSON.stringify(result), "EX", 86400 * 7);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Image processing failed" });
  }
};

const trackHandler = async (req: express.Request, res: express.Response) => {
  const { productId, source, sessionId } = req.body;
  console.log("Tracking click:", req.body);

  if (db) {
    try {
      await addDoc(collection(db, "click_tracking"), {
        product_id: productId,
        source: source,
        session_id: sessionId || null,
        created_at: new Date().toISOString()
      });
    } catch (err) {
      console.error("Tracking db error:", err);
    }
  }

  res.status(202).send();
};

app.get("/api/feed", feedHandler);
app.get("/api/search", searchHandler);
app.get("/api/image", imageHandler);
app.post("/api/track", trackHandler);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("GLOBAL SERVER ERROR:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
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
if (!process.env.VERCEL) {
  startServer();
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
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&q=80&w=1000",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=1000",
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
      rating: (Math.random() * 1 + 4).toFixed(1),
      reviewCount: Math.floor(Math.random() * 5000),
      specs: ["Pro Performance", "Sleek Design"],
      affiliateUrl,
    };
  });
}
