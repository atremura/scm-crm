'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  User as UserIcon,
  Inbox,
  Archive,
  ArchiveRestore,
  Loader2,
  FileText,
  Ruler,
  Calendar,
  Folder,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EstimatorPickerDialog } from '@/components/takeoff/estimator-picker-dialog';
import { DocumentsPanel } from '@/components/takeoff/documents-panel';
import { TakeoffRollupPanel } from '@/components/takeoff/takeoff-rollup-panel';
import { useSession } from 'next-auth/react';

type ApiProject = {
  id: string;
  name: string;
  projectNumber: string | null;
  address: string | null;
  workType: string | null;
  status: string;
  notes: string | null;
  startedAt: string;
  createdAt: string;
  client: {
    id: string;
    companyName: string;
    contacts: { name: string; email: string | null; phone: string | null }[];
  } | null;
  bid: { id: string; bidNumber: string; status: string; projectName: string } | null;
  estimator: { id: string; name: string; email: string } | null;
  sentToEstimateAt: string | null;
  sentToEstimateBy: { id: string; name: string } | null;
  estimateReceiver: { id: string; name: string; email: string } | null;
  estimateHandoffNote: string | null;
  estimate: { id: string; status: string } | null;
  documents: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    documentType: string;
    fileSizeKb: number | null;
    uploadedAt: string;
    uploader: { id: string; name: string } | null;
  }>;
  classifications: Array<{
    id: string;
    name: string;
    type: string;
    uom: string;
    quantity: number | string;
    unitCost: number | string | null;
  }>;
  imports: Array<{
    id: string;
    source: string;
    fileName: string | null;
    rowsImported: number;
    importedAt: string;
    user: { id: string; name: string } | null;
  }>;
};

type Tab = 'overview' | 'documents' | 'takeoff';

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [project, setProject] = useState<ApiProject | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [estimatorDialogOpen, setEstimatorDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function loadProject() {
    const r = await fetch(`/api/projects/${id}`);
    if (r.status === 404) {
      toast.error('Project not found');
      router.push('/takeoff');
      return;
    }
    if (!r.ok) {
      toast.error('Failed to load project');
      return;
    }
    const d = await r.json();
    if (d) setProject(d);
  }

  useEffect(() => {
    loadProject().catch(() => toast.error('Failed to load project'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function assignEstimator(estimatorId: string | null) {
    if (!project) return;
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimatorId }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      toast.error(d?.error ?? 'Failed to update estimator');
      return;
    }
    // Re-fetch full project so the Overview updates (includes user name/email).
    const fresh = await fetch(`/api/projects/${project.id}`).then((r) =>
      r.ok ? r.json() : null
    );
    if (fresh) setProject(fresh);
    toast.success(estimatorId ? 'Estimator assigned' : 'Estimator removed');
    setEstimatorDialogOpen(false);
  }

  async function deleteProject() {
    if (!project) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Failed to delete project');
        setDeleting(false);
        return;
      }
      toast.success('Project deleted');
      router.push('/takeoff');
    } catch {
      toast.error('Something went wrong');
      setDeleting(false);
    }
  }

  async function toggleArchive() {
    if (!project) return;
    const to = project.status === 'archived' ? 'active' : 'archived';
    setActionLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.error ?? 'Failed to change status');
        setActionLoading(false);
        return;
      }
      const updated = await res.json();
      setProject({ ...project, status: updated.status });
      toast.success(to === 'archived' ? 'Project archived' : 'Project restored');
    } catch {
      toast.error('Something went wrong');
    } finally {
      setActionLoading(false);
    }
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-16 text-fg-subtle">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading project…
      </div>
    );
  }

  const archived = project.status === 'archived';

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-5 p-6 md:p-8">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/takeoff">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
      </Button>

      {/* Head */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {project.projectNumber && (
              <span className="rounded-md bg-sunken px-2 py-0.5 font-mono text-[11.5px] font-semibold text-fg-muted">
                {project.projectNumber}
              </span>
            )}
            {project.bid && (
              <Link
                href={`/bids/${project.bid.id}`}
                className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-400 hover:underline"
              >
                <Inbox className="h-3 w-3" />
                From {project.bid.bidNumber}
              </Link>
            )}
            {archived && (
              <span className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
                <Archive className="h-3 w-3" /> Archived
              </span>
            )}
          </div>
          <h1 className="mt-2 text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            {project.name}
          </h1>
          {project.client && (
            <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-fg-muted">
              <Building2 className="h-3.5 w-3.5" />
              {project.client.companyName}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEstimatorDialogOpen(true)}
            disabled={archived}
          >
            <UserIcon className="h-3.5 w-3.5" />
            {project.estimator ? 'Change estimator' : 'Assign estimator'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleArchive}
            disabled={actionLoading}
          >
            {archived ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Restore
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Archive
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDeleteConfirm('');
              setDeleteDialogOpen(true);
            }}
            className="text-danger-500 hover:bg-danger-500/10 hover:text-danger-500"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex items-center gap-1 rounded-[10px] bg-sunken p-1">
        <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
          Overview
        </TabButton>
        <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>
          <FileText className="h-3.5 w-3.5" />
          Documents
          <Badge count={project.documents.length} />
        </TabButton>
        <TabButton active={tab === 'takeoff'} onClick={() => setTab('takeoff')}>
          <Ruler className="h-3.5 w-3.5" />
          Takeoff
          <Badge count={project.classifications.length} />
        </TabButton>
      </div>

      {tab === 'overview' && <OverviewPanel project={project} />}
      {tab === 'documents' && <DocumentsPanel projectId={project.id} />}
      {tab === 'takeoff' && (
        <TakeoffRollupPanel
          project={project}
          currentUserId={currentUserId}
          onProjectChanged={() => loadProject().catch(() => {})}
        />
      )}

      <EstimatorPickerDialog
        open={estimatorDialogOpen}
        onOpenChange={setEstimatorDialogOpen}
        title={project.estimator ? 'Change estimator' : 'Assign estimator'}
        description={
          project.estimator
            ? `Currently assigned to ${project.estimator.name}.`
            : 'Pick who will drive the takeoff for this project.'
        }
        initialEstimatorId={project.estimator?.id ?? null}
        allowUnassigned
        confirmLabel="Save"
        onConfirm={assignEstimator}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project</DialogTitle>
            <DialogDescription>
              This permanently removes the project, all its documents, classifications,
              and import history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 text-[13px]">
            <p className="text-fg-muted">
              To confirm, type the project name below:
            </p>
            <p className="rounded-md bg-sunken px-3 py-2 font-mono text-[12.5px] text-fg-default">
              {project.name}
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type the exact project name"
              disabled={deleting}
              autoFocus
            />
            {project.documents.length > 0 && (
              <p className="text-[12px] text-warn-500">
                {project.documents.length} document
                {project.documents.length === 1 ? '' : 's'} will also be deleted.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteProject}
              disabled={deleteConfirm !== project.name || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" /> Delete permanently
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverviewPanel({ project }: { project: ApiProject }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
      <Card>
        <SectionHeader title="Project details" />
        <div className="space-y-4 p-5 text-[13px]">
          <Detail label="Address" icon={MapPin} value={project.address ?? '—'} />
          <Detail label="Work type" icon={Folder} value={project.workType ?? '—'} />
          <Detail
            label="Estimator"
            icon={UserIcon}
            value={project.estimator?.name ?? 'Unassigned'}
          />
          <Detail
            label="Started"
            icon={Calendar}
            value={new Date(project.startedAt).toLocaleDateString()}
          />
          {project.notes && (
            <div className="border-t border-border pt-3">
              <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
                Notes
              </div>
              <p className="whitespace-pre-wrap text-fg-default">{project.notes}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="space-y-5">
        {project.client && (
          <Card>
            <SectionHeader title="Client" />
            <div className="space-y-2 p-5 text-[13px]">
              <div className="font-semibold text-fg-default">
                {project.client.companyName}
              </div>
              {project.client.contacts[0] && (
                <div className="text-fg-muted">
                  <div>{project.client.contacts[0].name}</div>
                  {project.client.contacts[0].email && (
                    <div className="text-[12px]">{project.client.contacts[0].email}</div>
                  )}
                </div>
              )}
            </div>
          </Card>
        )}

        {project.bid && (
          <Card>
            <SectionHeader title="Source bid" />
            <div className="space-y-2 p-5 text-[13px]">
              <Link
                href={`/bids/${project.bid.id}`}
                className="inline-flex items-center gap-2 font-semibold text-blue-400 hover:underline"
              >
                <Inbox className="h-3.5 w-3.5" />
                {project.bid.bidNumber}
              </Link>
              <div className="text-fg-muted">{project.bid.projectName}</div>
              <div className="text-[11.5px] uppercase tracking-wide text-fg-subtle">
                Status: {project.bid.status}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all ${
        active
          ? 'bg-surface text-fg-default shadow-sm'
          : 'text-fg-muted hover:text-fg-default'
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="rounded-full bg-ink-200 px-1.5 text-[10.5px] font-semibold text-fg-muted">
      {count}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-border px-5 py-3">
      <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        {title}
      </h3>
    </div>
  );
}

function Detail({
  label,
  icon: Icon,
  value,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle" />
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
          {label}
        </div>
        <div className="text-fg-default">{value}</div>
      </div>
    </div>
  );
}
