'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  MapPin,
  Briefcase,
  FileText,
  History as HistoryIcon,
  StickyNote,
  CheckCircle2,
  XCircle,
  Send,
  Trophy,
  Frown,
  Upload as UploadIcon,
  Download,
  Trash2,
  Pencil,
  Save,
  Loader2,
  AlertCircle,
  Link as LinkIcon,
  ExternalLink,
  FolderOpen,
  Globe,
  Video,
  FilePlus,
  Plus,
  Sparkles,
  Ruler,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  VALID_WORK_TYPES,
  VALID_PRIORITIES,
  VALID_DOCUMENT_TYPES,
  type DocumentType,
} from '@/lib/bid-utils';
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '@/lib/bid-utils';
import { EstimatorPickerDialog } from '@/components/takeoff/estimator-picker-dialog';

type Document = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  documentType: string | null;
  fileSizeKb: number | null;
  version: number;
  addendumNumber: number | null;
  replacedById: string | null;
  uploadedAt: string;
};

type HistoryEntry = {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  notes: string | null;
  changedAt: string;
  user: { id: string; name: string; email: string };
};

type BidDetail = {
  id: string;
  bidNumber: string;
  projectName: string;
  projectAddress: string | null;
  workType: string | null;
  status: string;
  priority: string;
  source: string;
  receivedDate: string | null;
  responseDeadline: string | null;
  distanceMiles: string | number | null;
  notes: string | null;
  bondRequired: boolean;
  unionJob: boolean;
  prevailingWage: boolean;
  davisBacon: boolean;
  insuranceRequirements: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    companyName: string;
    type: string | null;
    city: string | null;
    state: string | null;
    contacts: { id: string; name: string; email: string | null; phone: string | null; role: string | null; isPrimary: boolean }[];
  };
  assignedUser: { id: string; name: string; email: string } | null;
  documents: Document[];
  statusHistory: HistoryEntry[];
  links: BidLink[];
};

type BidLink = {
  id: string;
  url: string;
  label: string | null;
  category: string | null;
  source: string;
  createdAt: string;
};

type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  role: { name: string };
};

const STATUS_META: Record<
  string,
  { label: string; dot: string; text: string; bg: string }
> = {
  new: { label: 'New', dot: 'bg-ink-400', text: 'text-fg-muted', bg: 'bg-ink-100/60' },
  qualified: { label: 'Qualified', dot: 'bg-blue-500', text: 'text-blue-300', bg: 'bg-blue-500/15' },
  sent_to_takeoff: { label: 'Sent to Takeoff', dot: 'bg-success-500', text: 'text-success-500', bg: 'bg-success-500/15' },
  won: { label: 'Won', dot: 'bg-success-500', text: 'text-success-500', bg: 'bg-success-500/15' },
  lost: { label: 'Lost', dot: 'bg-danger-500', text: 'text-danger-500', bg: 'bg-danger-500/15' },
  rejected: { label: 'Rejected', dot: 'bg-danger-500', text: 'text-danger-500', bg: 'bg-danger-500/15' },
};

const SOURCE_META: Record<string, { label: string; className: string }> = {
  manual: { label: 'Manual', className: 'bg-ink-100/60 text-fg-muted border border-border' },
  email_ai: { label: 'Email AI', className: 'bg-violet-500/15 text-violet-500 border border-violet-500/30' },
  portal_api: { label: 'Portal API', className: 'bg-blue-500/15 text-blue-500 border border-blue-500/30' },
};

const PRIORITY_META: Record<string, string> = {
  low: 'bg-ink-100/60 text-fg-muted',
  medium: 'bg-blue-500/15 text-blue-500',
  high: 'bg-warn-500/15 text-warn-500',
  urgent: 'bg-danger-500/15 text-danger-500',
};

type TabKey = 'info' | 'docs' | 'history' | 'notes';

export default function BidDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bidId = params.id as string;

  const [bid, setBid] = useState<BidDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('info');

  const [assignOpen, setAssignOpen] = useState(false);
  const [startTakeoffOpen, setStartTakeoffOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  async function loadBid() {
    setLoading(true);
    try {
      const res = await fetch(`/api/bids/${bidId}`);
      if (!res.ok) {
        toast.error((await res.json()).error ?? 'Bid not found');
        router.push('/bids');
        return;
      }
      setBid(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId]);

  async function changeStatus(newStatus: string, notes?: string) {
    const res = await fetch(`/api/bids/${bidId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newStatus, notes: notes ?? null }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? 'Failed to change status');
      return false;
    }
    toast.success(`Status changed to ${STATUS_META[newStatus]?.label ?? newStatus}`);
    await loadBid();
    return true;
  }

  /** Spins up a Takeoff Project for this bid (estimator picked via dialog). */
  async function startTakeoff(estimatorId: string | null) {
    const res = await fetch('/api/projects/from-bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bidId, estimatorId, transitionBid: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data?.error ?? 'Failed to start takeoff');
      return;
    }
    toast.success('Takeoff project created');
    setStartTakeoffOpen(false);
    router.push(`/takeoff/${data.id}`);
  }

  if (loading && !bid) {
    return (
      <div className="mx-auto flex max-w-[1440px] items-center justify-center p-12 text-fg-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading bid…
      </div>
    );
  }

  if (!bid) return null;

  const statusMeta = STATUS_META[bid.status] ?? STATUS_META.new;
  const sourceMeta = SOURCE_META[bid.source] ?? SOURCE_META.manual;

  const activeDocs = bid.documents.filter((d) => !d.replacedById);
  const docsByAddendum = new Map<number | null, Document[]>();
  activeDocs.forEach((d) => {
    const key = d.addendumNumber ?? null;
    if (!docsByAddendum.has(key)) docsByAddendum.set(key, []);
    docsByAddendum.get(key)!.push(d);
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] p-6 md:p-8">
      {/* Breadcrumb + back */}
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/bids">
          <ArrowLeft className="h-4 w-4" />
          Bids
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 font-mono text-[12px] text-fg-muted">
            {bid.bidNumber}
          </div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            {bid.projectName}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusMeta.bg} ${statusMeta.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${sourceMeta.className}`}>
              {sourceMeta.label}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_META[bid.priority]}`}>
              {bid.priority}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-fg-subtle" />
              <span className="text-fg-default">{bid.client.companyName}</span>
            </span>
            {bid.responseDeadline && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-fg-subtle" />
                Due{' '}
                <span className="text-fg-default">
                  {new Date(bid.responseDeadline).toLocaleDateString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </span>
            )}
            {bid.distanceMiles && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-fg-subtle" />
                <span className="text-fg-default">{String(bid.distanceMiles)} mi</span>
              </span>
            )}
            {bid.assignedUser && (
              <span className="inline-flex items-center gap-1.5">
                Assigned to{' '}
                <span className="text-fg-default">{bid.assignedUser.name}</span>
              </span>
            )}
          </div>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2">
          {bid.status === 'new' && (
            <>
              <Button size="sm" onClick={() => changeStatus('qualified')}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Qualify
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}
          {bid.status === 'qualified' && (
            <>
              <Button size="sm" onClick={() => setStartTakeoffOpen(true)}>
                <Ruler className="h-3.5 w-3.5" />
                Start Takeoff
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <Send className="h-3.5 w-3.5" />
                Assign only
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </Button>
            </>
          )}
          {bid.status === 'sent_to_takeoff' && (
            <>
              <Button size="sm" variant="outline" onClick={() => setStartTakeoffOpen(true)}>
                <Ruler className="h-3.5 w-3.5" />
                New Takeoff version
              </Button>
              <Button size="sm" onClick={() => changeStatus('won')}>
                <Trophy className="h-3.5 w-3.5" />
                Mark as Won
              </Button>
              <Button size="sm" variant="outline" onClick={() => changeStatus('lost')}>
                <Frown className="h-3.5 w-3.5" />
                Mark as Lost
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-border">
        <TabBtn active={tab === 'info'} onClick={() => setTab('info')} icon={<Briefcase className="h-3.5 w-3.5" />}>
          Info
        </TabBtn>
        <TabBtn active={tab === 'docs'} onClick={() => setTab('docs')} icon={<FileText className="h-3.5 w-3.5" />}>
          Documents
          <span className="ml-1 rounded-full bg-sunken px-1.5 text-[10.5px] font-semibold text-fg-muted">
            {activeDocs.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon={<HistoryIcon className="h-3.5 w-3.5" />}>
          History
        </TabBtn>
        <TabBtn active={tab === 'notes'} onClick={() => setTab('notes')} icon={<StickyNote className="h-3.5 w-3.5" />}>
          Notes
        </TabBtn>
      </div>

      {tab === 'info' && <InfoTab bid={bid} onSaved={loadBid} />}
      {tab === 'docs' && (
        <DocsTab
          bidId={bidId}
          groups={docsByAddendum}
          onChanged={loadBid}
        />
      )}
      {tab === 'history' && <HistoryTab entries={bid.statusHistory} />}
      {tab === 'notes' && <NotesTab bid={bid} onSaved={loadBid} />}

      <AssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        bidId={bidId}
        onAssigned={loadBid}
      />
      <EstimatorPickerDialog
        open={startTakeoffOpen}
        onOpenChange={setStartTakeoffOpen}
        title="Start Takeoff"
        description="Create a takeoff project for this bid and assign an estimator."
        initialEstimatorId={bid.assignedTo ?? null}
        confirmLabel="Create project"
        onConfirm={startTakeoff}
      />
      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={async (notes) => {
          const ok = await changeStatus('rejected', notes);
          if (ok) setRejectOpen(false);
        }}
      />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2.5 text-[13px] font-semibold transition-colors ${
        active ? 'text-fg-default' : 'text-fg-muted hover:text-fg-default'
      }`}
    >
      {icon}
      {children}
      {active && (
        <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-blue-500" />
      )}
    </button>
  );
}

/* =========================================================
   INFO TAB
   ========================================================= */
function InfoTab({ bid, onSaved }: { bid: BidDetail; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [projectName, setProjectName] = useState(bid.projectName);
  const [projectAddress, setProjectAddress] = useState(bid.projectAddress ?? '');
  const [workType, setWorkType] = useState(bid.workType ?? '');
  const [priority, setPriority] = useState(bid.priority);
  const [responseDeadline, setResponseDeadline] = useState(
    bid.responseDeadline ? bid.responseDeadline.slice(0, 10) : ''
  );
  const [bondRequired, setBondRequired] = useState(bid.bondRequired);
  const [unionJob, setUnionJob] = useState(bid.unionJob);
  const [prevailingWage, setPrevailingWage] = useState(bid.prevailingWage);
  const [davisBacon, setDavisBacon] = useState(bid.davisBacon);
  const [insurance, setInsurance] = useState(bid.insuranceRequirements ?? '');

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bids/${bid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName,
          projectAddress: projectAddress || null,
          workType: workType || null,
          priority,
          responseDeadline: responseDeadline
            ? new Date(responseDeadline + 'T23:59:59').toISOString()
            : null,
          bondRequired,
          unionJob,
          prevailingWage,
          davisBacon,
          insuranceRequirements: insurance || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      toast.success('Bid updated');
      setEditing(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5">
        {/* Project card */}
        <Card
          title="Project"
          action={
            editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoField
              label="Project name"
              editing={editing}
              value={projectName}
              onChange={setProjectName}
              display={bid.projectName}
              className="sm:col-span-2"
            />
            <InfoField
              label="Project address"
              editing={editing}
              value={projectAddress}
              onChange={setProjectAddress}
              display={bid.projectAddress || '—'}
              className="sm:col-span-2"
              placeholder="123 Main St, Boston, MA"
            />
            <InfoSelect
              label="Work type"
              editing={editing}
              value={workType}
              onChange={setWorkType}
              display={bid.workType || '—'}
              options={VALID_WORK_TYPES.map((w) => ({ value: w, label: w }))}
              allowEmpty
            />
            <InfoField
              label="Response deadline"
              editing={editing}
              value={responseDeadline}
              onChange={setResponseDeadline}
              type="date"
              display={
                bid.responseDeadline
                  ? new Date(bid.responseDeadline).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            <InfoSelect
              label="Priority"
              editing={editing}
              value={priority}
              onChange={setPriority}
              display={bid.priority}
              options={VALID_PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
        </Card>

        {/* Industry requirements */}
        <Card title="Industry requirements">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ReqCell label="Bond required" editing={editing} value={bondRequired} onChange={setBondRequired} />
            <ReqCell label="Union job" editing={editing} value={unionJob} onChange={setUnionJob} />
            <ReqCell label="Prevailing wage" editing={editing} value={prevailingWage} onChange={setPrevailingWage} />
            <ReqCell label="Davis-Bacon" editing={editing} value={davisBacon} onChange={setDavisBacon} />
          </div>
          <div className="mt-4 space-y-1.5">
            <Label>Insurance requirements</Label>
            {editing ? (
              <Textarea
                value={insurance}
                onChange={(e) => setInsurance(e.target.value)}
                rows={3}
                placeholder="Insurance specifics…"
              />
            ) : (
              <div className="rounded-md border border-border bg-sunken/40 px-3 py-2 text-[13px] text-fg-default whitespace-pre-wrap">
                {bid.insuranceRequirements || <span className="text-fg-subtle">—</span>}
              </div>
            )}
          </div>
        </Card>

        <ProjectLinksCard bidId={bid.id} initial={bid.links} onChanged={onSaved} />
      </div>

      {/* Sidebar: client + meta */}
      <aside className="space-y-4">
        <Card title="Client">
          <div className="space-y-2">
            <div className="text-[14px] font-semibold text-fg-default">
              {bid.client.companyName}
            </div>
            <div className="text-[12px] text-fg-muted">
              {[bid.client.type, bid.client.city, bid.client.state]
                .filter(Boolean)
                .join(' · ') || '—'}
            </div>
            {bid.client.contacts.length > 0 && (
              <div className="mt-2 space-y-2 border-t border-border pt-3">
                {bid.client.contacts.slice(0, 3).map((c) => (
                  <div key={c.id} className="text-[12.5px]">
                    <div className="font-semibold text-fg-default">
                      {c.name}
                      {c.isPrimary && (
                        <span className="ml-2 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500">
                          Primary
                        </span>
                      )}
                    </div>
                    {c.email && <div className="text-fg-muted">{c.email}</div>}
                    {c.phone && <div className="text-fg-muted">{c.phone}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card title="Meta">
          <dl className="space-y-2 text-[12.5px]">
            <MetaRow label="Received">
              {bid.receivedDate
                ? new Date(bid.receivedDate).toLocaleDateString('en-US')
                : '—'}
            </MetaRow>
            <MetaRow label="Created">
              {new Date(bid.createdAt).toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </MetaRow>
            <MetaRow label="Updated">
              {new Date(bid.updatedAt).toLocaleString('en-US', {
                month: 'short',
                day: '2-digit',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </MetaRow>
            <MetaRow label="Documents">{bid.documents.filter((d) => !d.replacedById).length}</MetaRow>
          </dl>
        </Card>
      </aside>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="text-[13.5px] font-semibold text-fg-default">{title}</h3>
        {action}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function InfoField({
  label,
  editing,
  value,
  onChange,
  display,
  type = 'text',
  placeholder,
  className,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  display: React.ReactNode;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>{label}</Label>
      {editing ? (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <div className="rounded-md border border-border bg-sunken/40 px-3 py-2 text-[13px] text-fg-default">
          {display}
        </div>
      )}
    </div>
  );
}

function InfoSelect({
  label,
  editing,
  value,
  onChange,
  display,
  options,
  allowEmpty,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  display: React.ReactNode;
  options: { value: string; label: string }[];
  allowEmpty?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {editing ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={allowEmpty ? 'Unset' : undefined} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="rounded-md border border-border bg-sunken/40 px-3 py-2 text-[13px] text-fg-default capitalize">
          {display}
        </div>
      )}
    </div>
  );
}

function ReqCell({
  label,
  editing,
  value,
  onChange,
}: {
  label: string;
  editing: boolean;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-sunken/40 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-muted">
        {label}
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-fg-default">
          {value ? 'Yes' : 'No'}
        </span>
        {editing && <Switch checked={value} onCheckedChange={onChange} />}
      </div>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg-default">{children}</dd>
    </div>
  );
}

/* =========================================================
   DOCS TAB
   ========================================================= */
function DocsTab({
  bidId,
  groups,
  onChanged,
}: {
  bidId: string;
  groups: Map<number | null, Document[]>;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('plans');
  const [addendum, setAddendum] = useState<string>('');

  async function uploadFile() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', pendingFile);
      fd.append('documentType', docType);
      if (addendum.trim()) fd.append('addendumNumber', addendum.trim());
      const res = await fetch(`/api/bids/${bidId}/documents`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
      toast.success(`"${pendingFile.name}" uploaded`);
      setPendingFile(null);
      setDocType('plans');
      setAddendum('');
      onChanged();
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId: string, fileName: string) {
    if (!confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/bids/${bidId}/documents/${docId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Document deleted');
      onChanged();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? 'Failed to delete');
    }
  }

  const keys = [...groups.keys()].sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a - b;
  });

  return (
    <div className="space-y-5">
      {/* Dropzone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) setPendingFile(f);
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-sunken/30 px-6 py-6 text-center transition-colors hover:border-blue-500/50 hover:bg-sunken/60"
      >
        <UploadIcon className="h-6 w-6 text-fg-subtle" />
        <p className="mt-2 text-[13px] font-semibold text-fg-default">
          Drop a file or click to add a document
        </p>
        <p className="mt-1 text-[11.5px] text-fg-muted">
          PDF, DWG, RVT, XLS, DOC, PNG, JPG · up to 50MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > MAX_FILE_SIZE_BYTES) {
                toast.error('File exceeds 50MB');
              } else {
                setPendingFile(f);
              }
            }
            e.target.value = '';
          }}
        />
      </div>

      {/* Upload confirmation dialog */}
      <Dialog open={!!pendingFile} onOpenChange={(v) => !v && setPendingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              {pendingFile?.name} · {pendingFile && Math.round(pendingFile.size / 1024)} KB
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Document type</Label>
              <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Addendum number (optional)</Label>
              <Input
                type="number"
                min={1}
                value={addendum}
                onChange={(e) => setAddendum(e.target.value)}
                placeholder="Leave blank for original"
              />
              <p className="text-[11.5px] text-fg-muted">
                Use this when the GC issues an updated set — e.g. &quot;Addendum #1&quot;.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingFile(null)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={uploadFile} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadIcon className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document groups */}
      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface/40 px-6 py-10 text-center text-fg-subtle">
          <FileText className="mx-auto h-6 w-6" />
          <p className="mt-2 text-[13px]">No documents yet</p>
        </div>
      ) : (
        keys.map((k) => {
          const items = groups.get(k) ?? [];
          const title = k === null ? 'Original' : `Addendum #${k}`;
          return (
            <div
              key={String(k)}
              className="overflow-hidden rounded-lg border border-border bg-surface"
            >
              <header className="flex items-center justify-between border-b border-border px-5 py-3">
                <h4 className="text-[13px] font-semibold text-fg-default">{title}</h4>
                <span className="text-[11.5px] text-fg-muted">
                  {items.length} file{items.length === 1 ? '' : 's'}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {items.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-500/10 text-blue-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold text-fg-default">
                        {d.fileName}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-fg-muted">
                        <span className="uppercase">{d.documentType ?? 'other'}</span>
                        {d.fileSizeKb ? <span>· {Math.round(d.fileSizeKb)} KB</span> : null}
                        <span>
                          · Uploaded{' '}
                          {new Date(d.uploadedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: '2-digit',
                          })}
                        </span>
                        {d.version > 1 && (
                          <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500">
                            v{d.version}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" asChild title="Download">
                      <a href={d.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(d.id, d.fileName)}
                      title="Delete"
                      className="text-fg-muted hover:text-danger-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })
      )}
    </div>
  );
}

/* =========================================================
   HISTORY TAB
   ========================================================= */
function HistoryTab({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/40 px-6 py-10 text-center text-fg-subtle">
        No history yet
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <ol className="relative ml-3 border-l border-border">
        {entries.map((h) => {
          const meta = STATUS_META[h.toStatus] ?? STATUS_META.new;
          return (
            <li key={h.id} className="mb-5 pl-4 last:mb-0">
              <span
                className={`absolute -left-[5px] h-2.5 w-2.5 rounded-full ring-2 ring-surface ${meta.dot}`}
              />
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <span className="font-semibold text-fg-default">{h.user.name}</span>
                <span className="text-fg-muted">changed status</span>
                {h.fromStatus && (
                  <>
                    <span className="font-mono text-[11px] text-fg-subtle">
                      {STATUS_META[h.fromStatus]?.label ?? h.fromStatus}
                    </span>
                    <span className="text-fg-subtle">→</span>
                  </>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                  {meta.label}
                </span>
                <span className="ml-auto text-[11.5px] text-fg-subtle">
                  {new Date(h.changedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: '2-digit',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              {h.notes && (
                <div className="mt-1 text-[12.5px] leading-relaxed text-fg-muted">
                  {h.notes}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* =========================================================
   NOTES TAB
   ========================================================= */
function NotesTab({ bid, onSaved }: { bid: BidDetail; onSaved: () => void }) {
  const [value, setValue] = useState(bid.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/bids/${bid.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: value || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      toast.success('Notes saved');
      setDirty(false);
      onSaved();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(e.target.value !== (bid.notes ?? ''));
        }}
        rows={10}
        placeholder="Anything else worth remembering about this bid…"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11.5px] text-fg-subtle">
          {dirty ? 'Unsaved changes' : 'Up to date'}
        </span>
        <Button size="sm" disabled={!dirty || saving} onClick={save}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save notes
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   DIALOGS
   ========================================================= */
function AssignDialog({
  open,
  onOpenChange,
  bidId,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bidId: string;
  onAssigned: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/users?status=active')
      .then((r) => r.json())
      .then((u) => setUsers(u))
      .catch(() => toast.error('Failed to load users'));
  }, [open]);

  async function assign() {
    if (!userId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/bids/${bidId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to assign');
      toast.success('Bid assigned to Takeoff');
      onOpenChange(false);
      onAssigned();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send to Takeoff</DialogTitle>
          <DialogDescription>
            Pick a team member to handle the takeoff. Status changes to{' '}
            <span className="font-semibold">Sent to Takeoff</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Assignee</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user" />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} — {u.role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={assign} disabled={submitting || !userId}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    setSubmitting(true);
    try {
      await onConfirm(notes);
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this bid?</DialogTitle>
          <DialogDescription>
            The bid will be archived with status <span className="font-semibold">Rejected</span>.
            Add a short reason — it&apos;ll show in the history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Reason (optional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="e.g. Out of scope, too far from base, declined by client…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={submitting}>
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* =========================================================
   PROJECT LINKS CARD
   ========================================================= */
const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  documents: { label: 'Documents', icon: FolderOpen, color: 'text-blue-500 bg-blue-500/15' },
  portal: { label: 'Portal', icon: Globe, color: 'text-violet-500 bg-violet-500/15' },
  meeting: { label: 'Meeting', icon: Video, color: 'text-success-500 bg-success-500/15' },
  addendum: { label: 'Addendum', icon: FilePlus, color: 'text-warn-500 bg-warn-500/15' },
  other: { label: 'Link', icon: LinkIcon, color: 'text-fg-muted bg-sunken' },
};

function hostnameOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function ProjectLinksCard({
  bidId,
  initial,
  onChanged,
}: {
  bidId: string;
  initial: BidLink[];
  onChanged: () => void;
}) {
  const [links, setLinks] = useState<BidLink[]>(initial);
  const [adding, setAdding] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftCategory, setDraftCategory] = useState('other');
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLinks(initial); }, [initial]);

  async function addLink() {
    if (!draftUrl.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/bids/${bidId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: draftUrl.trim(),
          label: draftLabel.trim() || null,
          category: draftCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to add link');
      setLinks([...links, data]);
      setDraftUrl(''); setDraftLabel(''); setDraftCategory('other');
      setAdding(false);
      onChanged();
      toast.success('Link added');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add link');
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(linkId: string) {
    if (!confirm('Remove this link?')) return;
    const res = await fetch(`/api/bids/${bidId}/links/${linkId}`, { method: 'DELETE' });
    if (res.ok) {
      setLinks(links.filter((l) => l.id !== linkId));
      onChanged();
    } else {
      toast.error('Failed to remove link');
    }
  }

  return (
    <Card
      title={`Project links (${links.length})`}
      action={
        !adding && (
          <Button size='sm' variant='outline' onClick={() => setAdding(true)}>
            <Plus className='h-3.5 w-3.5' />
            Add link
          </Button>
        )
      }
    >
      {links.length === 0 && !adding && (
        <p className='rounded-md border border-dashed border-border bg-sunken/40 px-4 py-6 text-center text-[12.5px] text-fg-subtle'>
          No links yet. Plans, GC portal, walkthrough Zoom — anything web-based goes here.
        </p>
      )}

      {links.length > 0 && (
        <ul className='divide-y divide-border'>
          {links.map((link) => {
            const meta = CATEGORY_META[link.category ?? 'other'] ?? CATEGORY_META.other;
            const Icon = meta.icon;
            return (
              <li key={link.id} className='flex items-start gap-3 py-3 first:pt-0 last:pb-0'>
                <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${meta.color}`}>
                  <Icon className='h-4 w-4' />
                </div>
                <div className='min-w-0 flex-1'>
                  <a
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-default hover:text-blue-500'
                  >
                    {link.label || hostnameOf(link.url)}
                    <ExternalLink className='h-3 w-3' />
                  </a>
                  <div className='mt-0.5 truncate font-mono text-[11px] text-fg-muted'>
                    {hostnameOf(link.url)}
                  </div>
                  <div className='mt-1 flex items-center gap-2'>
                    <span className='text-[10.5px] uppercase tracking-[0.05em] text-fg-subtle'>
                      {meta.label}
                    </span>
                    {link.source === 'email_ai' && (
                      <span className='inline-flex items-center gap-0.5 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-violet-500'>
                        <Sparkles className='h-2 w-2' />
                        AI
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  onClick={() => removeLink(link.id)}
                  className='text-fg-muted hover:text-danger-500'
                  title='Remove'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {adding && (
        <div className='mt-3 rounded-md border border-blue-500/30 bg-blue-500/5 p-3 space-y-2'>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]'>
            <Input
              placeholder='https://…'
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              autoFocus
            />
            <Select value={draftCategory} onValueChange={setDraftCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder='Label (optional) — e.g. Plans on Dropbox'
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
          />
          <div className='flex justify-end gap-2'>
            <Button size='sm' variant='ghost' onClick={() => { setAdding(false); setDraftUrl(''); setDraftLabel(''); }} disabled={saving}>
              Cancel
            </Button>
            <Button size='sm' onClick={addLink} disabled={saving || !draftUrl.trim()}>
              {saving ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Plus className='h-3.5 w-3.5' />}
              Add
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

