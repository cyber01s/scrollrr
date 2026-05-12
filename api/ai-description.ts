import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { productName } = req.body;

    if (!productName) {
      return res.status(400).json({ error: 'productName is required' });
    }
    
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({ 
        description: "Experience top-tier quality and reliability with the " + productName + ". Perfect for modern homes and lifestyles." 
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Write a punchy, engaging 2-sentence TikTok/Reels style product description for: ${productName}. Make it sound like a cool recommendation. Keep it under 150 characters if possible.`
    });

    res.status(200).json({ description: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(200).json({ 
      description: "This top-rated product is designed to bring you the best experience possible." 
    });
  }
}
