export type Product = {
  id: string
  partnerId: string
  name: string
  category: string | null
  imageUrl: string | null
  price: number | null
  originalPrice: number | null
  currency: string
  affiliateUrl: string
  description: string | null
  brand: string | null
  rating: number | null
  reviewCount: number | null
  specs: any | null
  isActive: boolean
}

export type Partner = {
  id: number
  campaignId: string
  name: string
  trackingDomain: string | null
  catalogId: string | null
  lastSyncedAt: string | null
  isActive: boolean
}
