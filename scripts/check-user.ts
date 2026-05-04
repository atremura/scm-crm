import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = process.argv[2] ?? 'andre.tremura@awgconstructions.com';
  const password = process.argv[3] ?? 'Admin AWG 123!';

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true, company: true },
  });

  if (!user) {
    console.log('USER_NOT_FOUND:', email);
    const all = await prisma.user.findMany({
      select: {
        email: true,
        isActive: true,
        role: { select: { name: true } },
        company: { select: { name: true, slug: true } },
      },
    });
    console.log('All users in DB:', all);
    return;
  }

  console.log('FOUND:', {
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    role: user.role.name,
    company: user.company.name,
    companySlug: user.company.slug,
  });
  const match = await bcrypt.compare(password, user.passwordHash);
  console.log('PASSWORD_MATCH:', match);
}

main().finally(() => prisma.$disconnect());
