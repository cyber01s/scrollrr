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
    const searchQuery = req.query?.q as string;

    if (!searchQuery) {
      return res.status(200).json([]);
    }

    // For Vercel, return mock search results
    const mockResults = [
      {
        id: "search-result-1",
        name: `${searchQuery} Professional Model`,
        category: "SEARCH",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=1000",
        price: 299.99,
        currency: "USD",
        rating: 4.8,
        reviewCount: 1250,
        specs: ["High Performance", "Premium Quality"],
        affiliateUrl: "https://example.com/search-result-1",
      }
    ];

    return res.status(200).json(mockResults);

  } catch (error: any) {
    console.error('Search serverless error:', error);
    return res.status(200).json([]);
  }
}