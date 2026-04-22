'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { VALID_WORK_TYPES, VALID_PRIORITIES } from '@/lib/bid-utils';

type ExtractionResponse = {
  id: string;
  extractedData: {
    companyName: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    projectName: string | null;
    projectAddress: string | null;
    workType: string | null;
    responseDeadline: string | null;
    priority: string | null;
    bondRequired: boolean | null;
    unionJob: boolean | null;
    prevailingWage: boolean | null;
    davisBacon: boolean | null;
    insuranceRequirements: string | null;
    notes: string | null;
    summary: string;
    confidenceOverall: number;
    flags: string[];
    links: { url: string; label: string | null; category: string }[];
  };
  confidence: number | string | null;
  flags: string[] | null;
  summary: string | null;
  modelUsed: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  costCents: number | string | null;
};

type Step = 'paste' | 'review';
type ClientChoice = 'pick' | 'create';

type Priority = (typeof VALID_PRIORITIES)[number];

export function ExtractEmailDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('paste');

  // Step 1
  const [subject, setSubject] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [rawEmail, setRawEmail] = useState('');
  const [extracting, setExtracting] = useState(false);

  // Step 2 — extraction result + editable fields
  const [extraction, setExtraction] = useState<ExtractionResponse | null>(null);

  const [clientChoice, setClientChoice] = useState<ClientChoice>('create');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);

  // Editable bid fields (pre-populated from extraction)
  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [workType, setWorkType] = useState<string>('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [notes, setNotes] = useState('');
  const [bondRequired, setBondRequired] = useState(false);
  const [unionJob, setUnionJob] = useState(false);
  const [prevailingWage, setPrevailingWage] = useState(false);
  const [davisBacon, setDavisBacon] = useState(false);
  const [insuranceRequirements, setInsuranceRequirements] = useState('');

  const [creating, setCreating] = useState(false);

  function reset() {
    setStep('paste');
    setSubject('');
    setFromAddress('');
    setRawEmail('');
    setExtraction(null);
    setSelectedClient(null);
    setClientChoice('create');
  }

  async function handleExtract(e: React.FormEvent) {
    e.preventDefault();
    if (rawEmail.trim().length < 20) {
      toast.error('Paste a longer email body — at least 20 characters.');
      return;
    }
    setExtracting(true);
    try {
      const res = await fetch('/api/bids/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawEmail,
          subject: subject.trim() || null,
          fromAddress: fromAddress.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Extraction failed');
      const r = data as ExtractionResponse;
      setExtraction(r);

      // Pre-populate editable fields from the extraction
      const e = r.extractedData;
      setProjectName(e.projectName ?? '');
      setProjectAddress(e.projectAddress ?? '');
      // workType — match against VALID_WORK_TYPES, otherwise "Other"
      const matched = VALID_WORK_TYPES.find(
        (w) => w.toLowerCase() === (e.workType ?? '').toLowerCase()
      );
      setWorkType(matched ?? (e.workType ? 'Other' : ''));
      setResponseDeadline(e.responseDeadline ?? '');
      setPriority((e.priority as Priority | null) ?? 'medium');
      setNotes(e.notes ?? '');
      setBondRequired(e.bondRequired ?? false);
      setUnionJob(e.unionJob ?? false);
      setPrevailingWage(e.prevailingWage ?? false);
      setDavisBacon(e.davisBacon ?? false);
      setInsuranceRequirements(e.insuranceRequirements ?? '');

      setStep('review');
    } catch (err: any) {
      toast.error(err.message ?? 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreateBid() {
    if (!extraction) return;
    if (clientChoice === 'pick' && !selectedClient) {
      toast.error('Pick a client or switch to "Create new"');
      return;
    }
    if (clientChoice === 'create' && !extraction.extractedData.companyName) {
      toast.error("AI didn't find a company name — pick an existing client or paste a clearer email");
      return;
    }
    if (projectName.trim().length < 3) {
      toast.error('Project name must be at least 3 characters');
      return;
    }

    setCreating(true);
    try {
      const body: any = {
        extractionId: extraction.id,
        bid: {
          projectName: projectName.trim(),
          projectAddress: projectAddress.trim() || null,
          workType: workType || null,
          responseDeadline: responseDeadline || null,
          priority,
          notes: notes.trim() || null,
          bondRequired,
          unionJob,
          prevailingWage,
          davisBacon,
          insuranceRequirements: insuranceRequirements.trim() || null,
        },
      };
      if (clientChoice === 'pick') {
        body.clientId = selectedClient!.id;
      } else {
        const e = extraction.extractedData;
        body.newClient = {
          companyName: e.companyName,
          type: 'General Contractor',
          contactName: e.contactName,
          contactEmail: e.contactEmail,
          contactPhone: e.contactPhone,
        };
      }

      const res = await fetch('/api/bids/from-extraction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create bid');

      toast.success(`${data.bidNumber} created from email`);
      onOpenChange(false);
      reset();
      router.push(`/bids/${data.id}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create bid');
    } finally {
      setCreating(false);
    }
  }

  const e = extraction?.extractedData;
  const confidencePct = Math.round(Number(extraction?.confidence ?? 0));
  const confidenceColor =
    confidencePct >= 80
      ? 'text-success-500 bg-success-500/15'
      : confidencePct >= 50
        ? 'text-warn-500 bg-warn-500/15'
        : 'text-danger-500 bg-danger-500/15';

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-navy-800 to-blue-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <DialogTitle>
                {step === 'paste' ? 'Capture bid from email' : 'Review AI extraction'}
              </DialogTitle>
              <DialogDescription>
                {step === 'paste'
                  ? 'Paste the email body — Claude reads it and pre-fills the bid form.'
                  : 'Edit the AI suggestions if needed, then create the bid.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'paste' && (
          <form onSubmit={handleExtract} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="x-subject">Subject (optional)</Label>
                <Input
                  id="x-subject"
                  value={subject}
                  onChange={(ev) => setSubject(ev.target.value)}
                  placeholder="Bid Invite — Seaport Tower L12-14"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="x-from">From (optional)</Label>
                <Input
                  id="x-from"
                  type="email"
                  value={fromAddress}
                  onChange={(ev) => setFromAddress(ev.target.value)}
                  placeholder="estimating@suffolkconstruction.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="x-body">
                Email body <span className="text-danger-500">*</span>
              </Label>
              <Textarea
                id="x-body"
                value={rawEmail}
                onChange={(ev) => setRawEmail(ev.target.value)}
                rows={14}
                placeholder="Paste the full email body here — including dates, address, scope details. The more context, the better the extraction."
                className="font-mono text-[12.5px]"
              />
              <p className="text-[11px] text-fg-subtle">
                Uses Claude Opus 4.7 with structured output. ~$0.005–$0.02 per extraction.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={extracting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={extracting || rawEmail.trim().length < 20}>
                {extracting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Reading with Claude…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Extract
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'review' && extraction && e && (
          <div className="space-y-4">
            {/* Confidence + summary banner */}
            <div className="rounded-lg border border-border bg-sunken/40 p-3">
              <div className="flex items-start gap-3">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${confidenceColor}`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {confidencePct}% confidence
                </span>
                <p className="flex-1 text-[12.5px] leading-relaxed text-fg-default">
                  {extraction.summary || e.summary}
                </p>
              </div>
              {(extraction.flags ?? e.flags).length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {(extraction.flags ?? e.flags).map((flag, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[11.5px] text-warn-500"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-3 border-t border-border pt-2 text-[10.5px] text-fg-subtle">
                <span>
                  Model: <span className="font-mono">{extraction.modelUsed}</span>
                </span>
                <span>
                  Tokens in/out: {extraction.inputTokens}/{extraction.outputTokens}
                  {extraction.cacheReadTokens
                    ? ` (${extraction.cacheReadTokens} cached)`
                    : ''}
                </span>
                <span>
                  Cost: ¢{Number(extraction.costCents ?? 0).toFixed(3)}
                </span>
              </div>
            </div>

            {/* Client section */}
            <div className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-fg-muted" />
                <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
                  Client
                </span>
              </div>
              <div className="mb-3 inline-flex rounded-md bg-sunken p-0.5 text-[12px]">
                <button
                  type="button"
                  onClick={() => setClientChoice('create')}
                  className={`rounded px-3 py-1 font-semibold transition ${
                    clientChoice === 'create'
                      ? 'bg-surface text-fg-default shadow-sm'
                      : 'text-fg-muted'
                  }`}
                >
                  Create new
                </button>
                <button
                  type="button"
                  onClick={() => setClientChoice('pick')}
                  className={`rounded px-3 py-1 font-semibold transition ${
                    clientChoice === 'pick'
                      ? 'bg-surface text-fg-default shadow-sm'
                      : 'text-fg-muted'
                  }`}
                >
                  Pick existing
                </button>
              </div>
              {clientChoice === 'create' ? (
                <div className="rounded-md bg-sunken/40 p-3">
                  <div className="text-[13px] font-semibold text-fg-default">
                    {e.companyName ?? <span className="text-danger-500">Not detected</span>}
                  </div>
                  {e.contactName && (
                    <div className="mt-1 text-[11.5px] text-fg-muted">
                      Contact: {e.contactName}
                      {e.contactEmail && ` · ${e.contactEmail}`}
                      {e.contactPhone && ` · ${e.contactPhone}`}
                    </div>
                  )}
                  <div className="mt-1.5 text-[10.5px] text-fg-subtle">
                    A new General Contractor will be created with the contact above.
                  </div>
                </div>
              ) : (
                <ClientCombobox
                  value={selectedClient}
                  onChange={setSelectedClient}
                  onCreateNew={() => setClientChoice('create')}
                />
              )}
            </div>

            {/* Project fields */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
                Project
              </span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    Project name <span className="text-danger-500">*</span>
                  </Label>
                  <Input
                    value={projectName}
                    onChange={(ev) => setProjectName(ev.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address</Label>
                  <Input
                    value={projectAddress}
                    onChange={(ev) => setProjectAddress(ev.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Work type</Label>
                  <Select value={workType} onValueChange={setWorkType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_WORK_TYPES.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Response deadline</Label>
                  <Input
                    type="date"
                    value={responseDeadline}
                    onChange={(ev) => setResponseDeadline(ev.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Priority</Label>
                  <div className="inline-flex rounded-md bg-sunken p-0.5">
                    {VALID_PRIORITIES.map((p) => {
                      const active = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`rounded px-3 py-1 text-[12px] font-semibold capitalize transition ${
                            active
                              ? 'bg-surface text-fg-default shadow-sm'
                              : 'text-fg-muted'
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                <SwitchRow label="Bond" value={bondRequired} onChange={setBondRequired} />
                <SwitchRow label="Union" value={unionJob} onChange={setUnionJob} />
                <SwitchRow label="Prevailing wage" value={prevailingWage} onChange={setPrevailingWage} />
                <SwitchRow label="Davis-Bacon" value={davisBacon} onChange={setDavisBacon} />
              </div>

              {insuranceRequirements && (
                <div className="space-y-1.5 pt-1">
                  <Label>Insurance requirements</Label>
                  <Textarea
                    value={insuranceRequirements}
                    onChange={(ev) => setInsuranceRequirements(ev.target.value)}
                    rows={2}
                  />
                </div>
              )}

              {notes && (
                <div className="space-y-1.5 pt-1">
                  <Label>Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(ev) => setNotes(ev.target.value)}
                    rows={3}
                  />
                </div>
              )}
            </div>

            {/* Project links extracted by Claude */}
            {(e.links?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <span className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-violet-500">
                    Links Claude found ({e.links.length})
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {e.links.map((link, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-md bg-surface/60 px-2.5 py-2 text-[12px]"
                    >
                      <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase text-violet-500">
                        {link.category}
                      </span>
                      <div className="min-w-0 flex-1">
                        {link.label && (
                          <div className="truncate text-[12.5px] font-semibold text-fg-default">
                            {link.label}
                          </div>
                        )}
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-mono text-[10.5px] text-fg-muted hover:text-blue-500"
                        >
                          {link.url}
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10.5px] text-fg-subtle">
                  These will be saved on the bid&apos;s Info tab.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep('paste')}
                disabled={creating}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button onClick={handleCreateBid} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Creating bid…
                  </>
                ) : (
                  <>
                    <Mail className="h-3.5 w-3.5" />
                    Create bid from email
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-sunken/40 px-2.5 py-1.5">
      <span className="text-[11.5px] font-medium text-fg-default">{label}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
