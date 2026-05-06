import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

// Load from .env or .env.local if available
dotenv.config()
dotenv.config({ path: '.env.local' })

async function main() {
  const connectionString = process.env.DATABASE_URL
  
  if (!connectionString) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const sql = neon(connectionString)
  console.log('Running migrations...')

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS partners (
        id SERIAL PRIMARY KEY,
        campaign_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        tracking_domain TEXT,
        catalog_id TEXT,
        is_active BOOLEAN DEFAULT true,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
    console.log('✓ Partners table created')

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        partner_id TEXT REFERENCES partners(campaign_id),
        name TEXT NOT NULL,
        category TEXT,
        image_url TEXT,
        price NUMERIC(10,2),
        original_price NUMERIC(10,2),
        currency TEXT DEFAULT 'USD',
        affiliate_url TEXT NOT NULL,
        description TEXT,
        brand TEXT,
        rating NUMERIC(3,1),
        review_count INTEGER,
        specs JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
    console.log('✓ Products table created')

    try {
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS partner_id TEXT REFERENCES partners(campaign_id);`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS name TEXT;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS affiliate_url TEXT;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS rating NUMERIC(3,1);`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS review_count INTEGER;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS specs JSONB;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();`
      await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();`
    } catch(err: any) {
        console.log('Warning adding product columns:', err.message)
    }

    try {
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS tracking_domain TEXT;`
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS catalog_id TEXT;`
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`
      await sql`ALTER TABLE partners ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;`
    } catch(err: any) {
        console.log('Warning adding partner columns:', err.message)
    }

    await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`
    await sql`CREATE INDEX IF NOT EXISTS idx_products_updated ON products(updated_at DESC);`
    await sql`CREATE INDEX IF NOT EXISTS idx_products_partner ON products(partner_id);`
    
    // Add tsvector column for full-text search if it doesn't exist
    try {
        await sql`
          ALTER TABLE products ADD COLUMN search_vector tsvector 
          GENERATED ALWAYS AS (
            to_tsvector('english', coalesce(name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(category,'') || ' ' || coalesce(description,''))
          ) STORED;
        `
        await sql`CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vector);`
    } catch(err: any) {
        if (!err.message.includes('already exists')) {
            console.log('Warning on tsvector column:', err.message)
        }
    }

    console.log('✓ Product indexes created')

    await sql`
      CREATE TABLE IF NOT EXISTS clicks (
        id SERIAL PRIMARY KEY,
        product_id TEXT REFERENCES products(id),
        session_id TEXT,
        source TEXT,
        device TEXT,
        clicked_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
    console.log('✓ Clicks table created')

    await sql`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id SERIAL PRIMARY KEY,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        partners_synced INTEGER,
        products_upserted INTEGER,
        errors JSONB,
        duration_ms INTEGER
      );
    `
    console.log('✓ Sync logs table created')

    console.log('Migration complete!')
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

main()
