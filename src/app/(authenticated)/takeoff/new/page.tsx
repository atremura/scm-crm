'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VALID_WORK_TYPES } from '@/lib/bid-utils';

type ClientLite = { id: string; companyName: string };
type UserLite = { id: string; name: string; email: string };

const SENTINEL_NONE = '__none__';

export default function NewProjectPage() {
  const router = useRouter();

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);

  const [name, setName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [address, setAddress] = useState('');
  const [workType, setWorkType] = useState<string>('');
  const [clientId, setClientId] = useState<string>(SENTINEL_NONE);
  const [estimatorId, setEstimatorId] = useState<string>(SENTINEL_NONE);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/clients?status=active')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setClients(Array.isArray(d) ? d : []))
      .catch(() => setClients([]));

    fetch('/api/users?status=active')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setUsers(Array.isArray(d) ? d : []))
      .catch(() => setUsers([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim().length < 3) {
      toast.error('Project name must be at least 3 characters');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          projectNumber: projectNumber.trim() || null,
          address: address.trim() || null,
          workType: workType || null,
          clientId: clientId === SENTINEL_NONE ? null : clientId,
          estimatorId: estimatorId === SENTINEL_NONE ? null : estimatorId,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error ?? 'Failed to create project');
        setSaving(false);
        return;
      }
      toast.success('Project created');
      router.push(`/takeoff/${data.id}`);
    } catch {
      toast.error('Something went wrong');
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-5 p-6 md:p-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/takeoff">
            <ArrowLeft className="h-3.5 w-3.5" /> All projects
          </Link>
        </Button>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
          New Project
        </h1>
        <p className="mt-1 text-sm text-fg-muted">
          Start a standalone takeoff — for projects that didn&apos;t come through
          the bid funnel.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <SectionHeader title="Project" />
          <div className="space-y-4 p-5">
            <Field label="Name" htmlFor="name" required>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kanso Plymouth — Building 4"
                required
                disabled={saving}
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Project number" htmlFor="projectNumber" hint="Optional internal reference">
                <Input
                  id="projectNumber"
                  value={projectNumber}
                  onChange={(e) => setProjectNumber(e.target.value)}
                  placeholder="e.g. P-2026-014"
                  disabled={saving}
                />
              </Field>
              <Field label="Work type" htmlFor="workType">
                <Select
                  value={workType}
                  onValueChange={(v) => setWorkType(v === SENTINEL_NONE ? '' : v)}
                  disabled={saving}
                >
                  <SelectTrigger id="workType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SENTINEL_NONE}>(none)</SelectItem>
                    {VALID_WORK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Address" htmlFor="address">
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city, state"
                disabled={saving}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Parties" />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Client" htmlFor="clientId">
                <Select
                  value={clientId}
                  onValueChange={setClientId}
                  disabled={saving}
                >
                  <SelectTrigger id="clientId">
                    <SelectValue placeholder="(none)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SENTINEL_NONE}>(none)</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Estimator" htmlFor="estimatorId">
                <Select
                  value={estimatorId}
                  onValueChange={setEstimatorId}
                  disabled={saving}
                >
                  <SelectTrigger id="estimatorId">
                    <SelectValue placeholder="(unassigned)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SENTINEL_NONE}>(unassigned)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Notes" />
          <div className="p-5">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional — anything the team should know about this project"
              rows={4}
              disabled={saving}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button asChild variant="ghost" disabled={saving}>
            <Link href="/takeoff">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…
              </>
            ) : (
              'Create project'
            )}
          </Button>
        </div>
      </form>
    </div>
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

function Field({
  label,
  htmlFor,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="text-[13px] font-semibold text-fg-default">
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11.5px] text-fg-subtle">{hint}</p>}
    </div>
  );
}
