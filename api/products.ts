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

  if (!IMPACT_ACCOUNT_SID || !IMPACT_AUTH_TOKEN) {
    return res.status(400).json({ 
      error: 'Missing Impact.com credentials. Please set IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN environment variables.' 
    });
  }

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

    console.log(`[Impact API] Fetching from: ${impactUrl.replace(/:[^@]*@/, ':***@')}`);

    const response = await axios.get(impactUrl, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    console.log(`[Impact API] Response status: ${response.status}`);
    console.log(`[Impact API] Data keys:`, Object.keys(response.data));

    const items = response.data.CatalogItems || response.data.Items || [];
    
    if (items.length === 0) {
      console.warn(`[Impact API] No items returned for page ${page}`);
      return res.status(200).json({
        products: [],
        hasMore: false,
        total: 0,
        message: 'No products found. Check your Impact.com credentials and program ID.'
      });
    }

    const totalCount = parseInt(response.data['@total'] || response.data.TotalCount || (items.length * page)) || items.length;

    const products = items.map((item: any) => {
      // Impact.com typically returns these fields:
      // Id, Name, Description, Category, Price, RetailPrice, Url, ImageUrl, BrandName, etc.
      
      const affiliateLink = item.Url || item.Link || item.ProductUrl || '#';
      const imageUrl = item.ImageUrl || item.Image || item.ProductImage || '';
      const name = item.Name || item.ProductName || 'Product';
      const price = parseFloat(item.Price || item.SalePrice || '0');
      const retailPrice = parseFloat(item.RetailPrice || item.ListPrice || (price * 1.2) || '0');
      
      // Calculate discount percentage
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

    console.log(`[Impact API] Mapped ${products.length} products`);

    return res.status(200).json({
      products,
      hasMore: (page * limit) < totalCount,
      total: totalCount,
      currentPage: page,
      pageSize: limit,
    });

  } catch (error: any) {
    console.error('[Impact API] Error:', error.message);
    console.error('[Impact API] Response:', error?.response?.data);
    console.error('[Impact API] Status:', error?.response?.status);

    return res.status(error?.response?.status || 500).json({
      error: 'Failed to fetch products from Impact.com',
      details: error?.response?.data?.Message || error.message,
      hint: 'Verify your IMPACT_ACCOUNT_SID, IMPACT_AUTH_TOKEN, and IMPACT_PROGRAM_ID are correct.'
    });
  }
}

