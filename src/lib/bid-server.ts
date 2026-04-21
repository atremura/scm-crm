import { prisma } from '@/lib/prisma';

type BidTx = Pick<typeof prisma, 'bid'>;

/**
 * Generates a bid number like "BID-2026-0001", sequential per year.
 * Caller should run this inside a transaction to avoid race conditions
 * when multiple bids are created simultaneously.
 */
export async function generateBidNumber(tx: BidTx = prisma): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `BID-${year}-`;

  const last = await tx.bid.findFirst({
    where: { bidNumber: { startsWith: prefix } },
    orderBy: { bidNumber: 'desc' },
    select: { bidNumber: true },
  });

  let next = 1;
  if (last) {
    const tail = last.bidNumber.slice(prefix.length);
    const n = parseInt(tail, 10);
    if (!Number.isNaN(n)) next = n + 1;
  }

  return `${prefix}${String(next).padStart(4, '0')}`;
}
