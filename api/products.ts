import { IncomingMessage, ServerResponse } from 'http';
import axios from 'axios';

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: any;
}

interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (data: any) => void;
}

// Mock data fallback with realistic products
const MOCK_PRODUCTS = [
  {
    id: "eufy-s330",
    name: "Video Smart Lock S330 + HomeBase S380 (HomeBase 3) Black",
    category: "HOME & GARDEN",
    price: 589.98,
    oldPrice: 699.98,
    discount: "-16%",
    rating: 4.8,
    reviews: 670,
    imageUrl: "https://images.unsplash.com/photo-1558002038-1055907df827?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/eufy-s330",
    brand: "Eufy",
    sku: "EUFY-S330",
  },
  {
    id: "dyson-v15",
    name: "Dyson V15 Detect Absolute Cordless Vacuum",
    category: "HOME & APPLIANCES",
    price: 649.99,
    oldPrice: 749.99,
    discount: "-13%",
    rating: 4.9,
    reviews: 1240,
    imageUrl: "https://images.unsplash.com/photo-1558317374-067fb5f30001?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/dyson-v15",
    brand: "Dyson",
    sku: "DYSON-V15",
  },
  {
    id: "sony-xm5",
    name: "Sony WH-1000XM5 Wireless Noise Canceling Headphones",
    category: "ELECTRONICS",
    price: 348.00,
    oldPrice: 398.00,
    discount: "-12%",
    rating: 4.7,
    reviews: 3105,
    imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?q=80&w=1988&auto=format&fit=crop",
    affiliateLink: "https://example.com/sony-xm5",
    brand: "Sony",
    sku: "SONY-XM5",
  },
  {
    id: "iphone-15",
    name: "iPhone 15 Pro Max 256GB Titanium",
    category: "ELECTRONICS",
    price: 1199.00,
    oldPrice: 1299.00,
    discount: "-8%",
    rating: 4.9,
    reviews: 8420,
    imageUrl: "https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/iphone-15",
    brand: "Apple",
    sku: "IPHONE-15PM",
  },
  {
    id: "macbook-air",
    name: "MacBook Air 13-inch M3 Chip 8GB/256GB",
    category: "COMPUTERS",
    price: 999.00,
    oldPrice: 1099.00,
    discount: "-10%",
    rating: 4.8,
    reviews: 2150,
    imageUrl: "https://images.unsplash.com/photo-1517336714460-4c50193c63e4?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/macbook-air",
    brand: "Apple",
    sku: "MACBOOK-AIR-M3",
  },
  {
    id: "samsung-s24",
    name: "Samsung Galaxy S24 Ultra 512GB Titanium Black",
    category: "ELECTRONICS",
    price: 1299.99,
    oldPrice: 1419.99,
    discount: "-9%",
    rating: 4.7,
    reviews: 4500,
    imageUrl: "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/samsung-s24",
    brand: "Samsung",
    sku: "GALAXY-S24U",
  },
  {
    id: "nintendo-switch",
    name: "Nintendo Switch – OLED Model w/ White Joy-Con",
    category: "GAMING",
    price: 349.99,
    oldPrice: 399.99,
    discount: "-13%",
    rating: 4.9,
    reviews: 15600,
    imageUrl: "https://images.unsplash.com/photo-1578303372443-4f9bd49008bc?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/nintendo-switch",
    brand: "Nintendo",
    sku: "NSW-OLED",
  },
  {
    id: "kitchenaid-mixer",
    name: "KitchenAid Artisan Series 5-Quart Tilt-Head Stand Mixer",
    category: "KITCHEN",
    price: 379.99,
    oldPrice: 449.99,
    discount: "-16%",
    rating: 4.9,
    reviews: 52000,
    imageUrl: "https://images.unsplash.com/photo-1594385208974-2e75f9d8bc28?q=80&w=1974&auto=format&fit=crop",
    affiliateLink: "https://example.com/kitchenaid",
    brand: "KitchenAid",
    sku: "KA-MIXER-5Q",
  },
  {
    id: "ninja-air-fryer",
    name: "Ninja Foodi 6-in-1 8-qt. 2-Basket Air Fryer",
    category: "KITCHEN",
    price: 169.99,
    oldPrice: 199.99,
    discount: "-15%",
    rating: 4.8,
    reviews: 18400,
    imageUrl: "https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=2070&auto=format&fit=crop",
    affiliateLink: "https://example.com/ninja-air-fryer",
    brand: "Ninja",
    sku: "NINJA-AF6IN1",
  },
];

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

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 3;

  const { IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN, IMPACT_PROGRAM_ID } = process.env;

  // Try to fetch from Impact.com if credentials are available
  if (IMPACT_ACCOUNT_SID && IMPACT_AUTH_TOKEN) {
    try {
      const auth = Buffer.from(`${IMPACT_ACCOUNT_SID}:${IMPACT_AUTH_TOKEN}`).toString('base64');
      
      // Build the Impact.com API URL
      let impactUrl = `https://api.impact.com/Mediapartners/${IMPACT_ACCOUNT_SID}/Catalogs/Items`;
      
      const params = new URLSearchParams({
        PageSize: limit.toString(),
        PageNumber: page.toString(),
      });

      // Add CampaignId if provided
      if (IMPACT_PROGRAM_ID) {
        params.append('CampaignId', IMPACT_PROGRAM_ID);
      }

      impactUrl += '?' + params.toString();

      console.log(`[Impact API] Attempting to fetch products...`);

      const response = await axios.get(impactUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      console.log(`[Impact API] Success - Status: ${response.status}`);
      const items = response.data.CatalogItems || response.data.Items || [];
      
      if (items.length > 0) {
        const totalCount = parseInt(response.data['@total'] || response.data.TotalCount || (items.length * page)) || items.length;

        const products = items.map((item: any) => {
          const affiliateLink = item.Url || item.Link || item.ProductUrl || '#';
          const imageUrl = item.ImageUrl || item.Image || item.ProductImage || '';
          const name = item.Name || item.ProductName || 'Product';
          const price = parseFloat(item.Price || item.SalePrice || '0');
          const retailPrice = parseFloat(item.RetailPrice || item.ListPrice || (price * 1.2) || '0');
          
          let discount = '-0%';
          if (retailPrice > price && price > 0) {
            const discountPercent = Math.round((1 - price / retailPrice) * 100);
            discount = `-${discountPercent}%`;
          }

          return {
            id: item.Id || item.ProductId || Math.random().toString(36).substr(2, 9),
            name: name,
            description: item.Description || item.ProductDescription || '',
            category: item.Category || item.CategoryName || 'Products',
            price: price,
            oldPrice: retailPrice,
            discount: discount,
            rating: item.Rating || 4.5 + Math.random() * 0.5,
            reviews: item.ReviewCount || item.Reviews || Math.floor(Math.random() * 1000) + 50,
            imageUrl: imageUrl,
            affiliateLink: affiliateLink,
            brand: item.BrandName || item.Brand || '',
            sku: item.SKU || item.Sku || '',
          };
        });

        console.log(`[Impact API] Returning ${products.length} real products from Impact.com`);
        return res.status(200).json({
          products,
          hasMore: (page * limit) < totalCount,
          total: totalCount,
          currentPage: page,
          pageSize: limit,
          source: 'impact.com'
        });
      }
    } catch (error: any) {
      console.error('[Impact API] Error:', error?.message);
      console.error('[Impact API] Status:', error?.response?.status);
      // Fall through to mock data
    }
  } else {
    console.log('[Impact API] Credentials not set, using mock data');
  }

  // Fallback to mock data
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedProducts = MOCK_PRODUCTS.slice(startIndex, endIndex);
  const hasMore = endIndex < MOCK_PRODUCTS.length;

  console.log(`[Mock API] Returning ${paginatedProducts.length} mock products (page ${page})`);

  res.status(200).json({
    products: paginatedProducts,
    hasMore,
    total: MOCK_PRODUCTS.length,
    currentPage: page,
    pageSize: limit,
    source: 'mock',
    note: IMPACT_ACCOUNT_SID ? 'Impact.com API failed, using fallback' : 'Using demo data. Set Impact.com credentials to fetch real products.'
  });
}


