import { Product } from '@/types/product'

export function buildAffiliateUrl(product: Product): string {
  // Try to encode the product's destination url in the u parameterr base url
  // Just use affiliateUrl directly with appended partner info for now 
  const base = product.affiliateUrl || ''
  
  // NOTE: product.affiliateUrl should be the tracking link template
  // Make sure we have the impact partner property id appended
  const separator = base.includes('?') ? '&' : '?'
  
  // If we already have the partner property id, return as is, otherwise add it
  if (base.includes('partnerpropertyid=')) {
    return base
  }
  
  return `${base}${separator}partnerpropertyid=${process.env.NEXT_PUBLIC_IMPACT_PARTNER_PROPERTY_ID || process.env.IMPACT_PARTNER_PROPERTY_ID || '6988584'}`
}
