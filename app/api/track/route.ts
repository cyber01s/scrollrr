import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/neon'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { productId, partnerId, source, sessionId } = body
    
    // Fire and forget
    // @ts-ignore - Some edge runtimes support block until this promise resolves
    const insertPromise = sql`
      INSERT INTO clicks (product_id, session_id, source, device)
      VALUES (${productId}, ${sessionId}, ${source}, 'web')
    `
    // Ensure Vercel edge doesn't kill before insert
    if (typeof req.signal !== 'undefined' && (globalThis as any).waitUntil) {
        (globalThis as any).waitUntil(insertPromise)
    } else {
        await insertPromise
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    // Fail silently for tracking
    console.error('Tracking error:', error)
    return new NextResponse(null, { status: 204 })
  }
}
