import { IncomingMessage } from 'http';

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

const REAL_PRODUCTS = [
  {
    id: "sony-wh1000xm5",
    name: "Sony WH-1000XM5 Wireless Headphones",
    category: "AUDIO",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&q=80&w=1000",
    price: 348.00,
    originalPrice: 398.00,
    currency: "USD",
    rating: 4.8,
    reviewCount: 3420,
    specs: ["ANC Technology", "30-Hour Battery"],
    destinationUrl: "https://www.bestbuy.com/site/sony-wh1000xm5/6510150.p",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "dji-air3s",
    name: "DJI Air 3S Drone",
    category: "CAMERAS",
    imageUrl: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&q=80&w=1000",
    price: 1099.00,
    originalPrice: 1199.00,
    currency: "USD",
    rating: 4.9,
    reviewCount: 2156,
    specs: ["4K Camera", "42-Min Flight Time"],
    destinationUrl: "https://www.bhphotovideo.com/c/product/1697851-REG/dji_cp.ma_42_air3s.html",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "apple-watch-series9",
    name: "Apple Watch Series 9",
    category: "TECH",
    imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1000",
    price: 399.00,
    originalPrice: 429.00,
    currency: "USD",
    rating: 4.7,
    reviewCount: 5230,
    specs: ["LTPO OLED Display", "Always-On"],
    destinationUrl: "https://www.apple.com/watch/",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "playstation5",
    name: "PlayStation 5 Console",
    category: "GAMING",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000",
    price: 499.00,
    originalPrice: 499.00,
    currency: "USD",
    rating: 4.6,
    reviewCount: 8342,
    specs: ["4K Gaming", "120fps Support"],
    destinationUrl: "https://www.playstation.com/en-us/ps5/",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "dyson-v15",
    name: "Dyson V15 Detect Vacuum",
    category: "HOME",
    imageUrl: "https://images.unsplash.com/photo-1558317374-067fb5f30001?auto=format&fit=crop&q=80&w=1000",
    price: 649.99,
    originalPrice: 749.99,
    currency: "USD",
    rating: 4.8,
    reviewCount: 1890,
    specs: ["Laser Dust Detection", "60-Min Runtime"],
    destinationUrl: "https://www.dyson.com/vacuums/cordless/dyson-v15-detect/",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "peloton-bike-plus",
    name: "Peloton Bike+",
    category: "FITNESS",
    imageUrl: "https://images.unsplash.com/photo-1610438235354-a6ae5528385c?auto=format&fit=crop&q=80&w=1000",
    price: 1995.00,
    originalPrice: 2145.00,
    currency: "USD",
    rating: 4.5,
    reviewCount: 1245,
    specs: ["22-Inch Touchscreen", "Auto-Resistance"],
    destinationUrl: "https://www.onepeloton.com/shop/bikes/",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "yeti-rambler-26",
    name: "YETI Rambler 26oz Bottle",
    category: "OUTDOOR",
    imageUrl: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&q=80&w=1000",
    price: 45.00,
    originalPrice: 45.00,
    currency: "USD",
    rating: 4.9,
    reviewCount: 6542,
    specs: ["Vacuum Insulated", "Leakproof Cap"],
    destinationUrl: "https://www.yeticoolers.com/collections/drinkware",
    partnerId: "6183063",
    campaignId: "1236776",
  },
  {
    id: "gopro-hero12",
    name: "GoPro HERO 12 Black",
    category: "CAMERAS",
    imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&q=80&w=1000",
    price: 499.99,
    originalPrice: 499.99,
    currency: "USD",
    rating: 4.7,
    reviewCount: 3210,
    specs: ["5.3K Video", "Stabilization"],
    destinationUrl: "https://gopro.com/en/us/shop/hero12-black.html",
    partnerId: "6183063",
    campaignId: "1236776",
  },
];

function buildAffiliateUrl(product: any, page: number, index: number): string {
  const trackingId = `${page}-${index}`;
  return `https://buybestgear.sjv.io/c/${product.partnerId}/${product.campaignId}?u=${encodeURIComponent(product.destinationUrl)}&src=scrollr-${trackingId}&pid=${product.id}`;
}

function generateMockProducts(count: number, page: number): any[] {
  const startIdx = (page * count) % REAL_PRODUCTS.length;
  const products = [];
  
  for (let i = 0; i < count; i++) {
    const productIdx = (startIdx + i) % REAL_PRODUCTS.length;
    const baseProduct = REAL_PRODUCTS[productIdx];
    
    products.push({
      ...baseProduct,
      affiliateUrl: buildAffiliateUrl(baseProduct, page, i),
    });
  }
  
  return products;
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
    const requestId = Math.random().toString(36).substring(7);

    console.log(`[Feed][${requestId}] Vercel serverless request: page=${page}`);

    // For Vercel, we'll use mock data as the primary source
    // since we can't maintain persistent connections to databases
    const products = generateMockProducts(12, page);

    console.log(`[Feed][${requestId}] Returning ${products.length} mock products`);
    return res.status(200).json(products);

  } catch (error: any) {
    console.error('Feed serverless error:', error);
    // Always return mock data as fallback
    const products = generateMockProducts(12, 0);
    return res.status(200).json(products);
  }
}