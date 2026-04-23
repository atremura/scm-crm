import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/permissions';

// GET /api/users - List users in the current company
export async function GET(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get('status'); // 'active' | 'inactive' | 'all'
  const search = searchParams.get('search') || '';

  const where: any = { companyId: ctx.companyId };

  if (statusFilter === 'active') {
    where.isActive = true;
  } else if (statusFilter === 'inactive') {
    where.isActive = false;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  try {
    const users = await prisma.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });

    // Never return password hash
    const safeUsers = users.map((u) => {
      const { passwordHash, ...safe } = u;
      return safe;
    });

    return NextResponse.json(safeUsers);
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({ error: 'Failed to list users' }, { status: 500 });
  }
}

// POST /api/users - Create new user in the current company
export async function POST(req: NextRequest) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (ctx.role !== 'Admin') {
    return NextResponse.json({ error: 'Forbidden: only admins can create users' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, roleId, permissions } = body;

    if (!name || !email || !password || !roleId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, email, password, roleId' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Email is globally unique across all tenants
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    const role = await prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash,
          roleId,
          companyId: ctx.companyId,
          isActive: true,
        },
      });

      if (permissions && Array.isArray(permissions)) {
        await tx.userModulePermission.createMany({
          data: permissions.map((p: any) => ({
            userId: user.id,
            moduleId: p.moduleId,
            canView: p.canView || false,
            canCreate: p.canCreate || false,
            canEdit: p.canEdit || false,
            canDelete: p.canDelete || false,
          })),
        });
      }

      return user;
    });

    const { passwordHash: _, ...safeUser } = newUser;
    return NextResponse.json(safeUser, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
