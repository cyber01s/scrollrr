import { IncomingMessage } from 'http';
import { GoogleGenAI } from '@google/genai';

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

// Fallback specs for products when API is unavailable
const DEFAULT_SPECS: Record<string, string[]> = {
  "sony-wh1000xm5": ["Industry-Leading ANC", "30-Hour Battery Life", "Touch Controls"],
  "dji-air3s": ["48MP Main Camera", "42-Minute Flight Time", "Enterprise-Class Stabilization"],
  "apple-watch-series9": ["Always-On Retina Display", "Advanced Health Sensors", "Fitness Tracking"],
  "playstation5": ["4K Gaming at 120fps", "Ultra High Speed SSD", "Immersive DualSense Controller"],
  "dyson-v15": ["Laser Dust Detection", "420-Minute Runtime per Charge Cycle", "Advanced Filtration"],
  "peloton-bike-plus": ["22-Inch HD Touchscreen", "Auto-Resistance Technology", "Live & On-Demand Classes"],
  "yeti-rambler-26": ["Double-Wall Vacuum Insulation", "Rugged 18/8 Stainless Steel", "Leakproof Cap Design"],
  "gopro-hero12": ["5.3K Video Recording", "Exceptional Low-Light Performance", "Rugged & Waterproof"],
};

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

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let productName = '';
    let productId = '';

    // Support both POST (body) and GET (query params)
    if (req.method === 'POST') {
      productName = req.body?.productName || req.body?.name || '';
      productId = req.body?.productId || req.body?.id || '';
    } else {
      productName = (req.query?.name || req.query?.productName) as string;
      productId = (req.query?.id || req.query?.productId) as string;
    }

    if (!productName && !productId) {
      return res.status(400).json({ error: 'productName or productId is required' });
    }

    // Check if we have default specs for this product
    if (productId && DEFAULT_SPECS[productId]) {
      return res.status(200).json(DEFAULT_SPECS[productId]);
    }

    // Try to generate with Gemini if API key is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: `For this product "${productName}", generate exactly 3 key product specifications or features as a JSON array of strings. Example format: ["Feature 1", "Feature 2", "Feature 3"]. Return ONLY the JSON array, no other text.`
        });

        const text = response.text?.trim() || '';
        
        try {
          // Try to extract JSON array from response
          const jsonMatch = text.match(/\[.*\]/s);
          if (jsonMatch) {
            const specs = JSON.parse(jsonMatch[0]);
            if (Array.isArray(specs) && specs.length > 0) {
              return res.status(200).json(specs.slice(0, 3));
            }
          }
        } catch (parseError) {
          console.warn('Failed to parse Gemini specs response:', text);
        }
      } catch (geminiError) {
        console.warn('Gemini API error (using defaults):', geminiError);
      }
    }

    // Fallback to generic specs
    const genericSpecs = [
      "Premium Quality Construction",
      "Advanced Performance Features",
      "Enhanced User Experience"
    ];

    return res.status(200).json(genericSpecs);

  } catch (error: any) {
    console.error('Specs error:', error);
    return res.status(200).json([
      "Premium Quality",
      "Top Performance",
      "Excellent Reviews"
    ]);
  }
}