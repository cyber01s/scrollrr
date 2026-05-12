import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

// Fallback high-quality mock data if API fails or credentials missing
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
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
    affiliateLink: "https://impact.com/example-affiliate-link",
  }
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

  if (IMPACT_ACCOUNT_SID && IMPACT_AUTH_TOKEN) {
    try {
      const auth = Buffer.from(`${IMPACT_ACCOUNT_SID}:${IMPACT_AUTH_TOKEN}`).toString('base64');
      const impactUrl = `https://api.impact.com/Mediapartners/${IMPACT_ACCOUNT_SID}/Catalogs/Items`;
      
      const response = await axios.get(impactUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        params: {
          PageSize: limit,
          PageNumber: page,
          ...(IMPACT_PROGRAM_ID ? { CampaignId: IMPACT_PROGRAM_ID } : {})
        },
        timeout: 10000,
      });

      const items = response.data.CatalogItems || [];
      const totalCount = parseInt(response.data['@total'] || (items.length + (items.length > 0 ? limit : 0)));
      
      const products = items.map((item: any) => ({
        id: item.Id || Math.random().toString(36).substr(2, 9),
        name: item.Name || "Product Name",
        category: item.Category || "Miscellaneous",
        price: parseFloat(item.Price) || 0,
        oldPrice: parseFloat(item.RetailPrice) || parseFloat(item.Price) * 1.2,
        discount: item.RetailPrice ? `-${Math.round((1 - item.Price / item.RetailPrice) * 100)}%` : "-15%",
        rating: 4.5 + Math.random() * 0.5,
        reviews: Math.floor(Math.random() * 1000) + 50,
        imageUrl: item.ImageUrl || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1999&auto=format&fit=crop",
        affiliateLink: item.Url || "#",
      }));

      if (products.length > 0) {
        return res.status(200).json({
          products,
          hasMore: (page * limit) < totalCount,
          total: totalCount
        });
      }
    } catch (error: any) {
      console.error("Impact API Error:", error?.response?.data || error.message);
      // Fall through to mock data
    }
  }

  // Fallback / Mock
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedProducts = MOCK_PRODUCTS.slice(startIndex, endIndex);
  const hasMore = endIndex < MOCK_PRODUCTS.length;

  res.status(200).json({ 
    products: paginatedProducts,
    hasMore,
    total: MOCK_PRODUCTS.length
  });
}
