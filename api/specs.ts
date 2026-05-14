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

function parseSpecsFromText(text: string): string[] {
  const cleaned = text.trim();
  const jsonMatch = cleaned.match(/\[.*\]/s);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
      }
    } catch (err) {
      // ignore
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === 'string' && item.trim().length > 0);
    }
  } catch (err) {
    // ignore
  }

  const lines = cleaned.split(/\r?\n/).map((line) => line.replace(/^[-*\s]+/, '').trim()).filter(Boolean);
  if (lines.length >= 3) {
    return lines.slice(0, 3);
  }

  return [];
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
        const prompt = `You are a product expert. Generate exactly 3 concise, product-specific specification bullets for this product. Do not use generic marketing phrases such as Premium, Advanced, Enhanced, High Performance, or Superior. Use the product name and category to create realistic, unique specs. Return ONLY a JSON array of 3 strings.`;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `${prompt} Product Name: ${productName}. Category: ${req.query?.category || 'Unknown'}.`,
        });

        const text = (response.text ||
          response.output?.[0]?.content?.map((item: any) => item.text).join('') ||
          '').trim();

        const parsedSpecs = parseSpecsFromText(text);
        if (parsedSpecs.length > 0) {
          return res.status(200).json(parsedSpecs.slice(0, 3));
        }
      } catch (geminiError) {
        console.warn('Gemini API error:', geminiError);
      }
    }

    // Fallback to generic specs only if Gemini was unavailable or failed.
    const genericSpecs = [
      'Premium Quality Construction',
      'Advanced Performance Features',
      'Enhanced User Experience'
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