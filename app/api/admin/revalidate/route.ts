import { NextRequest, NextResponse } from 'next/server'

// Simple proxy to trigger the cron manually
export async function POST(req: NextRequest) {
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Pass it to the cron endpoint
  const url = new URL('/api/cron/sync-products', req.url)
  const cronRes = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${process.env.CRON_SECRET}`
    }
  })
  
  if (!cronRes.ok) {
    return NextResponse.json({ error: 'Sync failed' }, { status: cronRes.status })
  }
  
  const data = await cronRes.json()
  return NextResponse.json(data)
}
