import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const runId = process.argv[2];
  if (!runId) {
    console.error('Usage: npx tsx scripts/mark-stale-run-failed.ts <runId>');
    process.exit(1);
  }

  const updated = await prisma.projectAnalysisRun.update({
    where: { id: runId },
    data: {
      status: 'failed',
      errorMessage:
        'Background worker died (connection pool exhausted, fixed in next deploy). Start a new run.',
      completedAt: new Date(),
    },
    select: { id: true, status: true, errorMessage: true },
  });
  console.log('Marked as failed:', updated);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
