/**
 * Quick reset of the Kanso project so we can re-run accept-estimate
 * after schema/pricing changes. Deletes the Estimate (CASCADE drops
 * EstimateLine + EstimateCostFactor) and flips Project.status back
 * to 'sent_to_estimate'.
 *
 * Targets the JMO tenant + a project whose name contains "kanso".
 * If multiple match, lists them and refuses to act — Andre picks.
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

(async () => {
  const company = await prisma.company.findUnique({ where: { slug: 'jmo' } });
  if (!company) throw new Error('jmo company not found');

  const projects = await prisma.project.findMany({
    where: {
      companyId: company.id,
      name: { contains: 'kanso', mode: 'insensitive' },
    },
    include: { estimate: { select: { id: true, status: true } } },
  });

  if (projects.length === 0) {
    console.log('No project with "kanso" in name on JMO. Listing recent projects:');
    const recent = await prisma.project.findMany({
      where: { companyId: company.id },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: { estimate: { select: { id: true, status: true } } },
    });
    for (const p of recent) {
      console.log(
        `  ${p.id}  status=${p.status.padEnd(20)} estimate=${p.estimate?.id ?? '—'} · ${p.name}`
      );
    }
    process.exit(1);
  }

  console.log(`Resetting ${projects.length} project${projects.length === 1 ? '' : 's'}:\n`);

  for (const project of projects) {
    console.log(`Target: ${project.name} (${project.id})`);
    console.log(`  current status: ${project.status}`);
    console.log(`  current estimate: ${project.estimate?.id ?? '(none)'}`);

    await prisma.$transaction(async (tx) => {
      if (project.estimate) {
        await tx.estimate.delete({ where: { id: project.estimate.id } });
        console.log(`  ✓ deleted estimate ${project.estimate.id}`);
      }
      await tx.project.update({
        where: { id: project.id },
        data: {
          status: 'sent_to_estimate',
          estimateAcceptedAt: null,
        },
      });
      console.log(`  ✓ flipped status to sent_to_estimate\n`);
    });
  }

  console.log('\nDone. Andre can hit "Accept & start pricing" again.');
  await prisma.$disconnect();
})();
