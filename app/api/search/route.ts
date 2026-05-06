import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { redis } from '@/lib/redis'
import { sql } from '@/lib/neon'
import { withCache } from '@/lib/cache'

export const runtime = 'edge'

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1m'),
  analytics: true
})

export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim() || ''
  
  if (q.length < 2) {
    return NextResponse.json({ products: [] })
  }

  // Create hash by using built in base64
  const btoaFunc = typeof btoa === 'function' ? btoa : (str: string) => Buffer.from(str).toString('base64');
  const key = `search:${btoaFunc(q.toLowerCase()).slice(0, 16)}`
  
  try {
    const products = await withCache(key, 1800, async () => {
       const searchQuery = `%${q}%`
       return sql`SELECT *, ts_rank(search_vector, to_tsquery('english', ${q})) as rank
                  FROM products
                  WHERE is_active = true AND search_vector @@ to_tsquery('english', ${q})
                  ORDER BY rank DESC LIMIT 30`
    })

    const normalizedProducts = products.map(p => ({
       id: p.id,
       partnerId: p.partner_id,
       name: p.name,
       category: p.category,
       imageUrl: p.image_url,
       price: parseFloat(p.price) || null,
       originalPrice: parseFloat(p.original_price) || null,
       currency: p.currency,
       affiliateUrl: p.affiliate_url,
       description: p.description,
       brand: p.brand,
       rating: parseFloat(p.rating) || null,
       reviewCount: p.review_count,
       specs: p.specs,
       isActive: p.is_active
    }))

    return NextResponse.json({ products: normalizedProducts })
  } catch (error) {
    console.error('Search API error:', error)
    // Fallback simple ILIKE search if tsvector is not configured locally exactly right
    try {
        const searchQuery = `%${q}%`
        const fallbackProducts = await sql`SELECT * FROM products
            WHERE is_active = true AND (
              name ILIKE ${searchQuery} OR
              brand ILIKE ${searchQuery} OR
              category ILIKE ${searchQuery} OR
              description ILIKE ${searchQuery}
            ) LIMIT 30`
            
        const normalizedProducts = fallbackProducts.map(p => ({
           id: p.id,
           partnerId: p.partner_id,
           name: p.name,
           category: p.category,
           imageUrl: p.image_url,
           price: parseFloat(p.price) || null,
           originalPrice: parseFloat(p.original_price) || null,
           currency: p.currency,
           affiliateUrl: p.affiliate_url,
           description: p.description,
           brand: p.brand,
           rating: parseFloat(p.rating) || null,
           reviewCount: p.review_count,
           specs: p.specs,
           isActive: p.is_active
        }))
        return NextResponse.json({ products: normalizedProducts })
    } catch(fallbackError) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
  }
}
