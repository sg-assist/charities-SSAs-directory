import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

/**
 * GET /api/android/manifest
 *
 * Returns the latest signed OTA content bundle manifest.
 * Read-only — only the service role can publish new bundles via Supabase migrations.
 *
 * Response: { version, manifest, signature, published_at }
 */
export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      version: string
      manifest: unknown
      signature: string
      published_at: string
    }>>(
      `SELECT version, manifest, signature, published_at
       FROM mobile_content_bundles
       ORDER BY published_at DESC
       LIMIT 1`
    )

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No bundle available' }, { status: 404 })
    }

    return NextResponse.json(rows[0], {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    // Table may not exist yet (pre-migration) — return 404 gracefully
    return NextResponse.json({ error: 'No bundle available' }, { status: 404 })
  }
}
