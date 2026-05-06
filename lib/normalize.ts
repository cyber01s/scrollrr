import { Product } from '@/types/product'

export function normalizeProduct(rawItem: any, partnerCampaignId: string): Product {
  // impact.com Items schema handles map varying fields
  
  return {
    id: rawItem.Id,
    partnerId: partnerCampaignId,
    name: rawItem.Name || 'Unknown Product',
    category: rawItem.Category || null,
    imageUrl: rawItem.ImageUrl || null,
    price: parseFloat(rawItem.CurrentPrice) || parseFloat(rawItem.Price) || null,
    originalPrice: parseFloat(rawItem.OriginalPrice) || null,
    currency: rawItem.Currency || 'USD',
    affiliateUrl: rawItem.Url || rawItem.TrackingUrl || '',
    description: rawItem.Description || null,
    brand: rawItem.Brand || null,
    rating: rawItem.Rating ? parseFloat(rawItem.Rating) : null,
    reviewCount: rawItem.ReviewCount ? parseInt(rawItem.ReviewCount, 10) : null,
    specs: null,
    isActive: true
  }
}
