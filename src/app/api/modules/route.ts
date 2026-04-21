import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/modules - List all modules
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const modules = await prisma.module.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(modules);
  } catch (error) {
    console.error('Error listing modules:', error);
    return NextResponse.json({ error: 'Failed to list modules' }, { status: 500 });
  }
}