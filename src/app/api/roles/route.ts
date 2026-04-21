import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

// GET /api/roles - List all roles
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error listing roles:', error);
    return NextResponse.json({ error: 'Failed to list roles' }, { status: 500 });
  }
}