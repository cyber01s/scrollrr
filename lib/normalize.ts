import { Product } from '@/types/product'

export function normalizeProduct(rawItem: any, partnerCampaignId: string, trackingDomain?: string | null): Product {
  // impact.com Items schema handles map varying fields
  
  let finalAffiliateUrl = rawItem.TrackingUrl || rawItem.Url || '';
  
  if (rawItem.Url && !rawItem.TrackingUrl && trackingDomain) {
      const sep = trackingDomain.includes('?') ? '&' : '?';
      finalAffiliateUrl = `${trackingDomain}${sep}u=${encodeURIComponent(rawItem.Url)}`;
  }
  
  return {
    id: rawItem.Id,
    partnerId: partnerCampaignId,
    name: rawItem.Name || 'Unknown Product',
    category: rawItem.Category || null,
    imageUrl: rawItem.ImageUrl || null,
    price: parseFloat(rawItem.CurrentPrice) || parseFloat(rawItem.Price) || null,
    originalPrice: parseFloat(rawItem.OriginalPrice) || null,
    currency: rawItem.Currency || 'USD',
    affiliateUrl: finalAffiliateUrl,
    description: rawItem.Description || null,
    brand: rawItem.Brand || null,
    rating: rawItem.Rating ? parseFloat(rawItem.Rating) : null,
    reviewCount: rawItem.ReviewCount ? parseInt(rawItem.ReviewCount, 10) : null,
    specs: null,
    isActive: true
  }
}
