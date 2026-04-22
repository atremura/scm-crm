import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canDo, requireAuth } from '@/lib/permissions';
import { geocodeAddress } from '@/lib/geocoding';
import { distanceAndBearingFromBoston } from '@/lib/geo';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAuth();
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canDo(ctx, 'bid', 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const bid = await prisma.bid.findUnique({
    where: { id },
    select: { id: true, projectAddress: true },
  });
  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  if (!bid.projectAddress) {
    return NextResponse.json(
      { error: 'Bid has no project address to geocode' },
      { status: 400 }
    );
  }

  const result = await geocodeAddress(bid.projectAddress);
  if (!result) {
    return NextResponse.json(
      { error: 'Could not geocode that address' },
      { status: 422 }
    );
  }

  const { miles } = distanceAndBearingFromBoston(result.lat, result.lng);

  try {
    const updated = await prisma.bid.update({
      where: { id },
      data: {
        projectLatitude: result.lat,
        projectLongitude: result.lng,
        distanceMiles: Math.round(miles * 10) / 10,
      },
      select: {
        id: true,
        projectLatitude: true,
        projectLongitude: true,
        distanceMiles: true,
      },
    });
    return NextResponse.json({
      ...updated,
      displayName: result.displayName,
    });
  } catch (err) {
    console.error('[bids.geocode.POST]', err);
    return NextResponse.json({ error: 'Failed to save geocode' }, { status: 500 });
  }
}
