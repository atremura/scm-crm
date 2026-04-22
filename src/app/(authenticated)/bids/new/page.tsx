'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertCircle,
  Calendar,
  MapPin,
  Briefcase,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  ClientCombobox,
  type ClientOption,
} from '@/components/bids/client-combobox';
import { NewClientDialog } from '@/components/bids/new-client-dialog';
import { FileDropzone, type StagedFile } from '@/components/bids/file-dropzone';
import {
  VALID_WORK_TYPES,
  VALID_PRIORITIES,
  type BidPriority,
} from '@/lib/bid-utils';

type Priority = (typeof VALID_PRIORITIES)[number];

const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; ring: string }
> = {
  low: { label: 'Low', color: 'bg-ink-100/60 text-fg-muted', ring: 'ring-ink-300' },
  medium: { label: 'Medium', color: 'bg-blue-500/15 text-blue-500', ring: 'ring-blue-500' },
  high: { label: 'High', color: 'bg-warn-500/15 text-warn-500', ring: 'ring-warn-500' },
  urgent: { label: 'Urgent', color: 'bg-danger-500/15 text-danger-500', ring: 'ring-danger-500' },
};

function toTodayString(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const target = new Date(iso + 'T23:59:59');
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function NewBidPage() {
  const router = useRouter();

  // Client
  const [client, setClient] = useState<ClientOption | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);

  // Project
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [workType, setWorkType] = useState<string>('');
  const [customWorkType, setCustomWorkType] = useState('');
  const [receivedDate, setReceivedDate] = useState(toTodayString());
  const [responseDeadline, setResponseDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');

  // Industry
  const [industryOpen, setIndustryOpen] = useState(false);
  const [bondRequired, setBondRequired] = useState(false);
  const [unionJob, setUnionJob] = useState(false);
  const [prevailingWage, setPrevailingWage] = useState(false);
  const [davisBacon, setDavisBacon] = useState(false);
  const [insuranceRequirements, setInsuranceRequirements] = useState('');

  // Docs
  const [files, setFiles] = useState<StagedFile[]>([]);

  // Notes
  const [notes, setNotes] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const deadlineDays = useMemo(() => daysUntil(responseDeadline), [responseDeadline]);

  function validate(): { ok: boolean; missing: string[] } {
    const e: Record<string, string> = {};
    const missing: string[] = [];
    if (!client) {
      e.client = 'Select a client';
      missing.push('Client');
    }
    if (projectName.trim().length < 3) {
      e.projectName = 'At least 3 characters';
      missing.push('Project name');
    }
    if (!responseDeadline) {
      e.responseDeadline = 'Response deadline is required';
      missing.push('Response deadline');
    } else {
      const d = new Date(responseDeadline + 'T23:59:59');
      if (d.getTime() <= Date.now()) {
        e.responseDeadline = 'Deadline must be in the future';
        missing.push('Response deadline (must be future)');
      }
    }
    if (workType === 'Other' && customWorkType.trim().length < 2) {
      e.customWorkType = 'Describe the work type';
      missing.push('Custom work type');
    }
    setErrors(e);
    return { ok: Object.keys(e).length === 0, missing };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (!v.ok) {
      toast.error(`Missing or invalid: ${v.missing.join(', ')}`);
      // Scroll to first error
      requestAnimationFrame(() => {
        const firstErrorEl = document.querySelector('[aria-invalid="true"], [data-error="true"]');
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        clientId: client!.id,
        projectName: projectName.trim(),
        projectAddress: projectAddress.trim() || null,
        workType:
          workType === 'Other'
            ? customWorkType.trim()
            : workType || null,
        receivedDate: receivedDate ? new Date(receivedDate).toISOString() : null,
        responseDeadline: responseDeadline
          ? new Date(responseDeadline + 'T23:59:59').toISOString()
          : null,
        priority,
        notes: notes.trim() || null,
        bondRequired,
        unionJob,
        prevailingWage,
        davisBacon,
        insuranceRequirements: insuranceRequirements.trim() || null,
        source: 'manual',
      };

      const res = await fetch('/api/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create bid');

      // Upload files sequentially
      if (files.length > 0) {
        toast.loading(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`, {
          id: 'upload',
        });
        let uploaded = 0;
        for (const f of files) {
          const fd = new FormData();
          fd.append('file', f.file);
          fd.append('documentType', f.documentType);
          const upRes = await fetch(`/api/bids/${data.id}/documents`, {
            method: 'POST',
            body: fd,
          });
          if (!upRes.ok) {
            const err = await upRes.json().catch(() => ({}));
            toast.error(`"${f.file.name}" — ${err.error ?? 'upload failed'}`);
          } else {
            uploaded++;
          }
        }
        toast.dismiss('upload');
        if (uploaded > 0) toast.success(`${uploaded} file${uploaded === 1 ? '' : 's'} uploaded`);
      }

      toast.success(`${data.bidNumber} created successfully`);
      router.push(`/bids/${data.id}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create bid');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/bids">
            <ArrowLeft className="h-4 w-4" />
            Back to bids
          </Link>
        </Button>
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
          New Bid
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Manually log a bid received by email, phone, or any channel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT: Form */}
        <div className="space-y-5">
          {/* Section 1 — Client */}
          <Section
            icon={<Building2 className="h-4 w-4" />}
            title="Client"
            description="Who sent this bid?"
          >
            <ClientCombobox
              value={client}
              onChange={(c) => {
                setClient(c);
                if (c) setErrors((prev) => ({ ...prev, client: '' }));
              }}
              onCreateNew={() => setNewClientOpen(true)}
              error={errors.client}
            />
          </Section>

          {/* Section 2 — Project */}
          <Section
            icon={<Briefcase className="h-4 w-4" />}
            title="Project information"
            description="Core details about the opportunity"
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="project-name">
                  Project name <span className="text-danger-500">*</span>
                </Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Seaport Tower — Interior Buildout L12-14"
                  aria-invalid={!!errors.projectName}
                />
                {errors.projectName && (
                  <p className="text-[11.5px] text-danger-500">{errors.projectName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-address">Project address</Label>
                <Input
                  id="project-address"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  placeholder="123 Main St, Boston, MA"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Work type</Label>
                  <Select value={workType} onValueChange={setWorkType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select work type" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_WORK_TYPES.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {workType === 'Other' && (
                    <Input
                      placeholder="Describe work type"
                      value={customWorkType}
                      onChange={(e) => setCustomWorkType(e.target.value)}
                      aria-invalid={!!errors.customWorkType}
                    />
                  )}
                  {errors.customWorkType && (
                    <p className="text-[11.5px] text-danger-500">{errors.customWorkType}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="received-date">Received date</Label>
                  <Input
                    id="received-date"
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="response-deadline">
                    Response deadline <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    id="response-deadline"
                    type="date"
                    value={responseDeadline}
                    onChange={(e) => {
                      setResponseDeadline(e.target.value);
                      setErrors((p) => ({ ...p, responseDeadline: '' }));
                    }}
                    min={toTodayString()}
                    aria-invalid={!!errors.responseDeadline}
                  />
                  {errors.responseDeadline && (
                    <p className="text-[11.5px] text-danger-500">
                      {errors.responseDeadline}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <div className="inline-flex rounded-md bg-sunken p-0.5">
                    {(['low', 'medium', 'high', 'urgent'] as Priority[]).map((p) => {
                      const active = priority === p;
                      const meta = PRIORITY_META[p];
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`rounded px-3 py-1 text-[12px] font-semibold transition-all ${
                            active
                              ? `${meta.color} shadow-sm`
                              : 'text-fg-muted hover:text-fg-default'
                          }`}
                        >
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 3 — Industry requirements (collapsible) */}
          <Section
            icon={<AlertCircle className="h-4 w-4" />}
            title="Industry requirements"
            description="Bonds, unions, prevailing wage, insurance"
            collapsible
            open={industryOpen}
            onOpenChange={setIndustryOpen}
          >
            <div className="space-y-3">
              <RequirementRow
                label="Bond required"
                sublabel="Performance or payment bond demanded"
                checked={bondRequired}
                onChange={setBondRequired}
              />
              <RequirementRow
                label="Union job"
                sublabel="Only union labor allowed on site"
                checked={unionJob}
                onChange={setUnionJob}
              />
              <RequirementRow
                label="Prevailing wage"
                sublabel="State prevailing wage rates apply"
                checked={prevailingWage}
                onChange={setPrevailingWage}
              />
              <RequirementRow
                label="Davis-Bacon"
                sublabel="Federal Davis-Bacon Act rates apply"
                checked={davisBacon}
                onChange={setDavisBacon}
              />
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="insurance">Insurance requirements</Label>
                <Textarea
                  id="insurance"
                  value={insuranceRequirements}
                  onChange={(e) => setInsuranceRequirements(e.target.value)}
                  placeholder="e.g. $2M general liability, $1M auto, OCIP/CCIP, additional insured…"
                  rows={3}
                />
              </div>
            </div>
          </Section>

          {/* Section 4 — Documents */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Documents"
            description="Plans, specs, exhibits — uploaded after the bid is created"
          >
            <FileDropzone files={files} onFilesChange={setFiles} />
          </Section>

          {/* Section 5 — Notes */}
          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Notes"
            description="Anything else worth remembering"
          >
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about this bid…"
              rows={4}
            />
          </Section>
        </div>

        {/* RIGHT: Sticky preview */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Preview
            </div>

            <div className="space-y-3.5">
              <PreviewRow
                icon={<Briefcase className="h-3.5 w-3.5" />}
                label="Project"
                value={projectName || <span className="text-fg-subtle">Not set</span>}
              />
              <PreviewRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Client"
                value={
                  client?.companyName ?? <span className="text-fg-subtle">Not selected</span>
                }
              />
              <PreviewRow
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Address"
                value={projectAddress || <span className="text-fg-subtle">—</span>}
              />
              <PreviewRow
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Deadline"
                value={
                  responseDeadline ? (
                    <span>
                      {new Date(responseDeadline + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })}{' '}
                      <span
                        className={`ml-1 text-[11px] font-semibold ${
                          deadlineDays !== null && deadlineDays < 3
                            ? 'text-danger-500'
                            : deadlineDays !== null && deadlineDays < 7
                              ? 'text-warn-500'
                              : 'text-success-500'
                        }`}
                      >
                        {deadlineDays !== null && deadlineDays >= 0
                          ? `(${deadlineDays}d)`
                          : ''}
                      </span>
                    </span>
                  ) : (
                    <span className="text-fg-subtle">Not set</span>
                  )
                }
              />
              <PreviewRow
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Files"
                value={
                  files.length === 0 ? (
                    <span className="text-fg-subtle">None</span>
                  ) : (
                    `${files.length} file${files.length === 1 ? '' : 's'}`
                  )
                }
              />

              <div className="pt-2">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                  Priority
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_META[priority].color}`}
                >
                  {PRIORITY_META[priority].label}
                </span>
              </div>
            </div>

            {(() => {
              const requiredMissing: string[] = [];
              if (!client) requiredMissing.push('client');
              if (projectName.trim().length < 3) requiredMissing.push('project name');
              if (!responseDeadline) requiredMissing.push('deadline');
              return (
                <div className="mt-5 space-y-2 border-t border-border pt-4">
                  {requiredMissing.length > 0 && (
                    <div className="flex items-start gap-2 rounded-md border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[11.5px] text-warn-500">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <div>
                        Still missing:{' '}
                        <span className="font-semibold">{requiredMissing.join(', ')}</span>
                      </div>
                    </div>
                  )}
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={submitting}
                    title={
                      requiredMissing.length > 0
                        ? `Fill: ${requiredMissing.join(', ')}`
                        : undefined
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating bid…
                      </>
                    ) : (
                      'Create Bid'
                    )}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" asChild>
                    <Link href="/bids">Cancel</Link>
                  </Button>
                </div>
              );
            })()}

            <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
              A sequential <span className="font-mono">BID-YYYY-NNNN</span> number is assigned
              automatically. Documents upload after the bid is created.
            </p>
          </div>
        </aside>
      </form>

      <NewClientDialog
        open={newClientOpen}
        onOpenChange={setNewClientOpen}
        onCreated={(c) => setClient(c)}
      />
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
  collapsible,
  open,
  onOpenChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
  collapsible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div
        onClick={collapsible ? () => onOpenChange?.(!open) : undefined}
        className={`flex items-center gap-3 px-5 py-4 ${
          collapsible ? 'cursor-pointer select-none hover:bg-sunken/40' : ''
        }`}
      >
        <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-500/10 text-blue-500">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-[14.5px] font-semibold leading-tight text-fg-default">
            {title}
          </h3>
          <p className="mt-0.5 text-[12px] text-fg-muted">{description}</p>
        </div>
        {collapsible && (
          <ChevronDown
            className={`h-4 w-4 text-fg-muted transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        )}
      </div>
      {(!collapsible || open) && (
        <div className="border-t border-border px-5 py-4">{children}</div>
      )}
    </section>
  );
}

function RequirementRow({
  label,
  sublabel,
  checked,
  onChange,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md px-0.5 py-1">
      <div>
        <div className="text-[13px] font-semibold text-fg-default">{label}</div>
        <div className="mt-0.5 text-[11.5px] text-fg-muted">{sublabel}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        <span className="text-fg-subtle">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-[13px] text-fg-default">{value}</div>
    </div>
  );
}
