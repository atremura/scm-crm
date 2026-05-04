import { prisma } from '@/lib/prisma';
import { generateBidNumber } from '@/lib/bid-server';
import { gmailClientFromRefresh, downloadAttachment, type GmailAttachment } from '@/lib/gmail';
import { saveBidFile } from '@/lib/storage';
import { geocodeAddress } from '@/lib/geocoding';
import { distanceAndBearingFromBoston } from '@/lib/geo';

/** Map common file extensions to our document_type categories. */
function inferDocumentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg'].includes(ext)) return 'photo';
  if (['pdf', 'dwg', 'rvt'].includes(ext)) return 'plans';
  if (['xls', 'xlsx'].includes(ext)) return 'other';
  if (['doc', 'docx'].includes(ext)) return 'specs';
  return 'other';
}

export type BidOverrides = {
  projectName: string;
  projectAddress: string | null;
  workType: string | null;
  responseDeadline: string | null; // ISO date
  priority: string;
  notes: string | null;
  bondRequired: boolean;
  unionJob: boolean;
  prevailingWage: boolean;
  davisBacon: boolean;
  insuranceRequirements: string | null;
};

export type NewClientPayload = {
  companyName: string;
  type?: string | null;
  city?: string | null;
  state?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

export type AcceptExtractionOpts = {
  /** Tenant scope — the extraction, client, and bid all must belong to this company. */
  companyId: string;
  /** Use this existing client. If unset, must provide newClient. */
  clientId?: string;
  /** Inline-create this client during the same transaction. */
  newClient?: NewClientPayload;
  /** Field overrides for the bid. If unset, derived from extraction.extractedData. */
  bidOverrides?: BidOverrides;
  /** Force a specific status. Default 'new' for manual, 'qualified' or 'rejected' for auto. */
  forceStatus?: 'new' | 'qualified' | 'rejected';
  /** Reason written to status history (e.g. "Auto-rejected: distance 145mi > 100mi"). */
  statusNote?: string | null;
  /** Pre-computed lat/lng (skip geocoding inside the creator). */
  prefilledLat?: number | null;
  prefilledLng?: number | null;
  prefilledDistance?: number | null;
  /** User performing the action (for status history). */
  actorUserId: string;
};

export type AcceptResult = {
  bidId: string;
  bidNumber: string;
  clientId: string;
};

/**
 * Core: take a pending BidExtraction and turn it into a real Bid.
 * Used by:
 *   - /api/bids/from-extraction (manual review path) — passes bidOverrides
 *   - /api/gmail/sync auto-mode (skips review) — derives overrides from extraction
 */
export async function acceptExtractionAsBid(
  extractionId: string,
  opts: AcceptExtractionOpts,
): Promise<AcceptResult> {
  const extraction = await prisma.bidExtraction.findFirst({
    where: { id: extractionId, companyId: opts.companyId },
  });
  if (!extraction) throw new Error('Extraction not found');
  if (extraction.status !== 'pending') {
    throw new Error('Extraction has already been processed');
  }

  // If caller pinned an existing client, verify it belongs to this tenant.
  if (opts.clientId) {
    const existingClient = await prisma.client.findFirst({
      where: { id: opts.clientId, companyId: opts.companyId },
      select: { id: true },
    });
    if (!existingClient) throw new Error('Client not found');
  }

  // Build bid fields — either from explicit overrides (manual review) or from
  // the AI extraction itself (auto-create).
  const e = extraction.extractedData as any;
  const bidFields: BidOverrides = opts.bidOverrides ?? {
    projectName: e?.projectName ?? '(no project name)',
    projectAddress: e?.projectAddress ?? null,
    workType: e?.workType ?? null,
    responseDeadline: e?.responseDeadline ?? null,
    priority: e?.priority ?? 'medium',
    notes: e?.notes ?? null,
    bondRequired: e?.bondRequired ?? false,
    unionJob: e?.unionJob ?? false,
    prevailingWage: e?.prevailingWage ?? false,
    davisBacon: e?.davisBacon ?? false,
    insuranceRequirements: e?.insuranceRequirements ?? null,
  };

  const status = opts.forceStatus ?? 'new';

  const result = await prisma.$transaction(
    async (tx) => {
      // 1. Resolve / create the client
      let clientId = opts.clientId ?? '';
      if (!clientId) {
        if (!opts.newClient) {
          throw new Error('Must provide clientId or newClient');
        }
        const client = await tx.client.create({
          data: {
            companyId: opts.companyId,
            companyName: opts.newClient.companyName,
            type: opts.newClient.type ?? null,
            city: opts.newClient.city ?? null,
            state: opts.newClient.state ?? null,
            contacts: opts.newClient.contactName
              ? {
                  create: [
                    {
                      name: opts.newClient.contactName,
                      email: opts.newClient.contactEmail ?? null,
                      phone: opts.newClient.contactPhone ?? null,
                      isPrimary: true,
                    },
                  ],
                }
              : undefined,
          },
        });
        clientId = client.id;
      }

      // 2. Generate the bid number + create the bid
      const bidNumber = await generateBidNumber(tx as any, opts.companyId);
      const bid = await tx.bid.create({
        data: {
          companyId: opts.companyId,
          bidNumber,
          clientId,
          projectName: bidFields.projectName,
          projectAddress: bidFields.projectAddress,
          workType: bidFields.workType,
          receivedDate: new Date(),
          responseDeadline: bidFields.responseDeadline
            ? new Date(bidFields.responseDeadline + 'T23:59:59')
            : null,
          priority: bidFields.priority,
          notes: bidFields.notes,
          bondRequired: bidFields.bondRequired,
          unionJob: bidFields.unionJob,
          prevailingWage: bidFields.prevailingWage,
          davisBacon: bidFields.davisBacon,
          insuranceRequirements: bidFields.insuranceRequirements,
          source: 'email_ai',
          status,
          // Prefilled geo (auto-create path): skip the slow Nominatim retry below
          projectLatitude: opts.prefilledLat ?? null,
          projectLongitude: opts.prefilledLng ?? null,
          distanceMiles:
            opts.prefilledDistance !== null && opts.prefilledDistance !== undefined
              ? opts.prefilledDistance
              : null,
        },
      });

      // 3. History entry
      const conf = extraction.confidence ?? 'n/a';
      const baseNote = `Bid created from AI email extraction (confidence ${conf})`;
      const note = opts.statusNote ? `${baseNote}. ${opts.statusNote}` : baseNote;
      await tx.bidStatusHistory.create({
        data: {
          bidId: bid.id,
          changedBy: opts.actorUserId,
          fromStatus: null,
          toStatus: status,
          notes: note,
        },
      });

      // 4. Project links extracted from the email
      const extractedLinks = e?.links;
      if (Array.isArray(extractedLinks) && extractedLinks.length > 0) {
        await tx.bidLink.createMany({
          data: extractedLinks
            .filter((l: any) => l && typeof l.url === 'string' && l.url.startsWith('http'))
            .map((l: any) => ({
              companyId: opts.companyId,
              bidId: bid.id,
              url: l.url,
              label: l.label ?? null,
              category: l.category ?? 'other',
              source: 'email_ai',
            })),
        });
      }

      // 5. Mark the extraction accepted + link
      await tx.bidExtraction.update({
        where: { id: extraction.id },
        data: {
          bidId: bid.id,
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });

      return { bidId: bid.id, bidNumber: bid.bidNumber, clientId };
    },
    {
      // Neon serverless cold-start can push past the default 5s easily.
      timeout: 30_000,
      maxWait: 10_000,
    },
  );

  // 6. Best-effort attachment download (outside the transaction)
  const attachments = extraction.attachments as GmailAttachment[] | null;
  if (Array.isArray(attachments) && attachments.length > 0) {
    const user = await prisma.user.findUnique({
      where: { id: opts.actorUserId },
      select: { gmailRefreshToken: true },
    });
    if (user?.gmailRefreshToken) {
      const gmail = gmailClientFromRefresh(user.gmailRefreshToken);
      for (const att of attachments) {
        try {
          const buf = await downloadAttachment(gmail, att.messageId, att.attachmentId);
          // Wrap the Node Buffer in a Uint8Array view so it satisfies the
          // BlobPart union (Buffer<ArrayBufferLike> isn't assignable to
          // ArrayBufferView<ArrayBuffer> on Node 24 + @types/node 20).
          const blob = new Blob([new Uint8Array(buf)], { type: att.mimeType });
          const file = new File([blob], att.filename, { type: att.mimeType });
          const saved = await saveBidFile(file, result.bidId);
          await prisma.bidDocument.create({
            data: {
              bidId: result.bidId,
              fileName: saved.fileName,
              fileUrl: saved.url,
              fileType: saved.fileType,
              fileSizeKb: saved.fileSizeKb,
              documentType: inferDocumentType(att.filename),
            },
          });
        } catch (e) {
          console.warn('[bid-creator] attachment download failed', att.filename, e);
        }
      }
    }
  }

  // 7. Best-effort geocoding (outside the transaction) — only if not prefilled
  if (opts.prefilledLat === null || opts.prefilledLat === undefined) {
    if (bidFields.projectAddress) {
      try {
        const geo = await geocodeAddress(bidFields.projectAddress);
        if (geo) {
          const { miles } = distanceAndBearingFromBoston(geo.lat, geo.lng);
          await prisma.bid.update({
            where: { id: result.bidId },
            data: {
              projectLatitude: geo.lat,
              projectLongitude: geo.lng,
              distanceMiles: Math.round(miles * 10) / 10,
            },
          });
        }
      } catch (err) {
        console.warn('[bid-creator] geocode failed', err);
      }
    }
  }

  return result;
}
