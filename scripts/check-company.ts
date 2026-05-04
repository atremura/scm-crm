import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      contactName: true,
      phone: true,
      email: true,
      baseAddress: true,
      logoUrl: true,
    },
  });
  console.log(JSON.stringify(companies, null, 2));
}

main().finally(() => prisma.$disconnect());
