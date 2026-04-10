import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organisationName, organisationSlug, reporterEmail, details } = body as {
      organisationName: string;
      organisationSlug: string;
      reporterEmail?: string;
      details: string;
    };

    if (!organisationName || !details) {
      return NextResponse.json(
        { error: 'Organisation name and details are required' },
        { status: 400 }
      );
    }

    // Log the report for now — can be extended to store in DB or send email
    console.log('[Directory Report] Incorrect details reported:', {
      organisationName,
      organisationSlug,
      reporterEmail,
      details,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Thank you for your report. Our team will review the details.',
    });
  } catch (error) {
    console.error('[Directory Report] Error:', error);
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}
