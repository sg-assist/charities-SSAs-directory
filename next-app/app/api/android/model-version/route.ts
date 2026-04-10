import { NextResponse } from 'next/server'

/**
 * GET /api/android/model-version
 *
 * Returns metadata about the latest recommended Gemma 4 model for the
 * Android and iOS apps.
 *
 * Response: { filename, variant, sizeBytes, minRamGb, downloadUrl, sha256 }
 */

const MODEL_VARIANTS = [
  {
    filename: 'gemma4-e2b-int4.litertlm',
    variant: 'E2B',
    displayName: 'Gemma 4 E2B (INT4)',
    sizeBytes: 1_350_000_000,
    minRamGb: 6,
    // HuggingFace Hub URL — update when new quantization is available
    downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma4-e2b-int4.litertlm',
    sha256: null,  // populated when model is finalized
    recommended: true,
  },
  {
    filename: 'gemma4-e4b-int4.litertlm',
    variant: 'E4B',
    displayName: 'Gemma 4 E4B (INT4)',
    sizeBytes: 2_500_000_000,
    minRamGb: 8,
    downloadUrl: 'https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma4-e4b-int4.litertlm',
    sha256: null,
    recommended: false,
  },
]

export async function GET() {
  return NextResponse.json(
    { variants: MODEL_VARIANTS },
    {
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    },
  )
}
