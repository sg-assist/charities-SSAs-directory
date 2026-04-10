import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const category = searchParams.get('category');
    const q = searchParams.get('q');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = { isActive: true };

    if (type) {
      where.type = type;
    }

    if (category) {
      where.categories = { has: category };
    }

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [organisations, total] = await Promise.all([
      prisma.organisation.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limit,
      }),
      prisma.organisation.count({ where }),
    ]);

    return NextResponse.json({
      organisations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Directory API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organisations' },
      { status: 500 }
    );
  }
}
