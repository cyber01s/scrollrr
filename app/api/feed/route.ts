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
  const page = parseInt(searchParams.get('page') || '0', 10)
  const category = searchParams.get('category') || 'all'

  const key = `feed:${page}:${category}`
  
  try {
    const products = await withCache(key, 21600, async () => {
      if (category === 'all') {
        return sql`SELECT * FROM products 
                   WHERE is_active = true 
                   ORDER BY updated_at DESC
                   LIMIT 20 OFFSET ${page * 20}`
      } else {
        return sql`SELECT * FROM products 
                   WHERE is_active = true AND category = ${category}
                   ORDER BY updated_at DESC
                   LIMIT 20 OFFSET ${page * 20}`
      }
    })

    // Check if database is empty to fallback gracefully
    if (page === 0 && products.length === 0) {
       const countResult = await sql`SELECT COUNT(*) as exact_count FROM products`
       if (countResult[0]?.exact_count == 0) {
           return NextResponse.json({ products: [], empty: true })
       }
    }

    // Convert keys from DB (snake_case) to Frontend model (camelCase)
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

    return NextResponse.json({ products: normalizedProducts, empty: false })
  } catch (error) {
    console.error('Feed API error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
