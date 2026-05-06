import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/neon'
import { redis } from '@/lib/redis'
import { fetchImpactCampaigns, fetchImpactCatalogItems } from '@/lib/impact'
import { normalizeProduct } from '@/lib/normalize'

// Not an edge runtime because fetching hundreds of products might exceed 
// Edge runtime limits or require Node APIs if impact SDK was used.
// We'll configure maxDuration to 60s in vercel.json for this function.

export const maxDuration = 60; // Allow enough time for syncing

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  let partnersSynced = 0
  let productsUpserted = 0
  let currentPartner = 'init'

  try {
    // 1. Fetch campaigns (partners)
    const campaignsRes = await fetchImpactCampaigns()
    const campaigns: any[] = campaignsRes.Campaigns || []
    
    for (const campaign of campaigns) {
      if (campaign.Status !== 'ACTIVE') continue
      
      const campaignId = campaign.CampaignId?.toString()
      const catalogId = campaign.CatalogId?.toString() || null
      // The advertiser's default raw link
      const trackingDomain = campaign.TrackingLink || null
      
      if (!campaignId) continue
      
      // Update partner table
      await sql`
        INSERT INTO partners (campaign_id, name, tracking_domain, catalog_id, last_synced_at, is_active)
        VALUES (${campaignId}, ${campaign.CampaignName || campaign.AdvertiserName || 'Unknown'}, ${trackingDomain}, ${catalogId}, NOW(), true)
        ON CONFLICT (campaign_id) 
        DO UPDATE SET last_synced_at = NOW(), is_active = true, tracking_domain = EXCLUDED.tracking_domain, catalog_id = EXCLUDED.catalog_id
      `
      partnersSynced++
      
      // Fetch catalog if they have one
      if (catalogId) {
        currentPartner = campaignId
        // Fetch first 5 pages to respect constraints
        for (let page = 0; page < 5; page++) {
          const itemsRes = await fetchImpactCatalogItems(catalogId, page, 100)
          const items: any[] = itemsRes.Items || []
          if (!items || items.length === 0) break
          
          for (const item of items) {
             const product = normalizeProduct(item, campaignId, trackingDomain)
             if (!product.id || !product.name) continue
             
             await sql`
                INSERT INTO products (
                   id, partner_id, name, category, image_url, price, 
                   original_price, currency, affiliate_url, description, 
                   brand, rating, review_count, specs, is_active, updated_at
                )
                VALUES (
                   ${product.id}, ${product.partnerId}, ${product.name}, ${product.category},
                   ${product.imageUrl}, ${product.price}, ${product.originalPrice}, ${product.currency},
                   ${product.affiliateUrl}, ${product.description}, ${product.brand}, 
                   ${product.rating}, ${product.reviewCount}, ${product.specs ? JSON.stringify(product.specs) : null}, true, NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                   price = EXCLUDED.price,
                   original_price = EXCLUDED.original_price,
                   image_url = EXCLUDED.image_url,
                   affiliate_url = EXCLUDED.affiliate_url,
                   is_active = true,
                   updated_at = NOW()
             `
             productsUpserted++
          }
        }
      }
    }
    
    // Invalidate caches
    const feedKeys = await redis.keys('feed:*')
    const searchKeys = await redis.keys('search:*')
    const otherKeys = ['categories:all', 'partners:all']
    const allKeys = [...feedKeys, ...searchKeys, ...otherKeys]
    
    if (allKeys.length > 0) {
      await Promise.all(allKeys.map(k => redis.del(k)))
    }
    
    const durationMs = Date.now() - startTime
    await sql`
      INSERT INTO sync_logs (partners_synced, products_upserted, duration_ms)
      VALUES (${partnersSynced}, ${productsUpserted}, ${durationMs})
    `

    return NextResponse.json({ success: true, partnersSynced, productsUpserted, durationMs })
    
  } catch (error: any) {
    console.error('Cron sync error:', error)
    await sql`
      INSERT INTO sync_logs (errors, duration_ms)
      VALUES (${JSON.stringify({ message: error.message, partner: currentPartner })}, ${Date.now() - startTime})
    `
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
