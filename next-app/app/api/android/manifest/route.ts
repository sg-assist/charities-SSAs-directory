import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/android/manifest
 *
 * Returns the latest signed OTA content bundle manifest.
 * Read-only — only Supabase service role can publish new bundles.
 *
 * Response: { version, manifest, signature, published_at }
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('mobile_content_bundles')
    .select('version, manifest, signature, published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No bundle available' }, { status: 404 })
  }

  return NextResponse.json(data, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
