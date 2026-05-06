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

// Seeded Random function (Mulberry32)
const mulberry32 = (a: number) => {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

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
  const seedParam = searchParams.get('seed')
  const seed = seedParam ? parseInt(seedParam, 10) : 42

  const poolKey = `feed:pool:${category}`
  
  try {
    const productsPool = await withCache(poolKey, 3600, async () => {
      // Fetch up to 1000 products for the pool to avoid exhausting DB queries while keeping variety
      if (category === 'all') {
        return sql`SELECT * FROM products 
                   WHERE is_active = true 
                   ORDER BY random()
                   LIMIT 500`
      } else {
        return sql`SELECT * FROM products 
                   WHERE is_active = true AND category = ${category}
                   ORDER BY random()
                   LIMIT 500`
      }
    })

    // Fallback if empty database
    if (page === 0 && productsPool.length === 0) {
       const countResult = await sql`SELECT COUNT(*) as exact_count FROM products`
       if (countResult[0]?.exact_count == 0) {
           return NextResponse.json({ products: [], empty: true })
       }
    }

    // Shuffle pool with seed
    const rng = mulberry32(seed)
    const shuffledPool = [...productsPool]
    for (let i = shuffledPool.length - 1; i > 0; i--) {
       const j = Math.floor(rng() * (i + 1));
       [shuffledPool[i], shuffledPool[j]] = [shuffledPool[j], shuffledPool[i]]
    }

    // Paginate the shuffled pool
    const pageSize = 20
    const offset = page * pageSize
    const paginatedProducts = shuffledPool.slice(offset, offset + pageSize)

    // Convert keys from DB (snake_case) to Frontend model (camelCase)
    const normalizedProducts = paginatedProducts.map(p => ({
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
