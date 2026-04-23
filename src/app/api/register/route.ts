import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  companyName: z.string().min(2),
  companySlug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  adminName: z.string().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  baseAddress: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  let data: z.infer<typeof registerSchema>;
  try {
    const body = await req.json();
    data = registerSchema.parse(body);
  } catch (err: any) {
    const issue = err?.issues?.[0]?.message ?? err?.message ?? 'Invalid input';
    return NextResponse.json({ error: issue, issues: err?.issues }, { status: 400 });
  }

  try {
    const [slugExists, emailExists, adminRole, modules] = await Promise.all([
      prisma.company.findUnique({ where: { slug: data.companySlug } }),
      prisma.user.findUnique({ where: { email: data.adminEmail } }),
      prisma.role.findUnique({ where: { name: 'Admin' } }),
      prisma.module.findMany(),
    ]);

    if (slugExists) {
      return NextResponse.json(
        { error: 'Company slug already taken' },
        { status: 400 }
      );
    }
    if (emailExists) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }
    if (!adminRole) {
      return NextResponse.json(
        { error: 'System not initialized — Admin role missing' },
        { status: 500 }
      );
    }

    const passwordHash = await bcrypt.hash(data.adminPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: data.companyName,
          slug: data.companySlug,
          baseAddress: data.baseAddress || null,
          maxDistanceMiles: 100,
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          name: data.adminName,
          email: data.adminEmail,
          passwordHash,
          roleId: adminRole.id,
          companyId: company.id,
          isActive: true,
        },
      });

      if (modules.length > 0) {
        await tx.userModulePermission.createMany({
          data: modules.map((m) => ({
            userId: user.id,
            moduleId: m.id,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
          })),
        });
      }

      return { companyId: company.id, userId: user.id };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[register.POST]', err);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
