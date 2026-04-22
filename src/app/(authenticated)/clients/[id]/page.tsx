'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Mail,
  Phone,
  Plus,
  Pencil,
  Save,
  Trash2,
  Star,
  Loader2,
  Archive,
  RotateCcw,
  Briefcase,
  Calendar,
  ExternalLink,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CLIENT_TYPES = [
  'General Contractor',
  'Developer',
  'Architect',
  'Property Owner',
  'Other',
];

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  isPrimary: boolean;
};

type ClientDetail = {
  id: string;
  companyName: string;
  type: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  contacts: Contact[];
  bids: Array<{
    id: string;
    bidNumber: string;
    projectName: string;
    status: string;
    responseDeadline: string | null;
    createdAt: string;
  }>;
  _count: { bids: number };
};

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  new: { label: 'New', bg: 'bg-ink-100/60', text: 'text-fg-muted' },
  qualified: { label: 'Qualified', bg: 'bg-blue-500/15', text: 'text-blue-300' },
  sent_to_takeoff: {
    label: 'Sent to Takeoff',
    bg: 'bg-success-500/15',
    text: 'text-success-500',
  },
  won: { label: 'Won', bg: 'bg-success-500/15', text: 'text-success-500' },
  lost: { label: 'Lost', bg: 'bg-danger-500/15', text: 'text-danger-500' },
  rejected: { label: 'Rejected', bg: 'bg-danger-500/15', text: 'text-danger-500' },
};

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  // Editable fields
  const [companyName, setCompanyName] = useState('');
  const [type, setType] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');

  // Contacts (managed inline)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Client not found');
        router.push('/clients');
        return;
      }
      const data: ClientDetail = await res.json();
      setClient(data);
      setCompanyName(data.companyName);
      setType(data.type ?? '');
      setAddress(data.address ?? '');
      setCity(data.city ?? '');
      setState(data.state ?? '');
      setZipCode(data.zipCode ?? '');
      setContacts(data.contacts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function saveClient() {
    if (companyName.trim().length < 2) {
      toast.error('Company name is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          type: type || null,
          address: address.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          zipCode: zipCode.trim() || null,
          contacts: contacts.map((c) => ({
            id: c.id.startsWith('tmp-') ? undefined : c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            role: c.role,
            isPrimary: c.isPrimary,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      toast.success('Client saved');
      setEditing(false);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success('Client archived');
      router.push('/clients');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
      setSaving(false);
      setArchiveOpen(false);
    }
  }

  async function reactivate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      toast.success('Client reactivated');
      load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  }

  function handleContactSaved(contact: Contact) {
    setContacts((prev) => {
      const existing = prev.find((c) => c.id === contact.id);
      let next: Contact[];
      if (existing) {
        next = prev.map((c) => (c.id === contact.id ? contact : c));
      } else {
        next = [...prev, contact];
      }
      // Enforce single primary
      if (contact.isPrimary) {
        next = next.map((c) =>
          c.id === contact.id ? c : { ...c, isPrimary: false }
        );
      }
      return next;
    });
    setEditingContact(null);
    setContactDialogOpen(false);
    setEditing(true); // mark dirty
  }

  function handleContactDelete(id: string) {
    if (!confirm('Remove this contact?')) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setEditing(true);
  }

  function setPrimary(id: string) {
    setContacts((prev) =>
      prev.map((c) => ({ ...c, isPrimary: c.id === id }))
    );
    setEditing(true);
  }

  if (loading && !client) {
    return (
      <div className="mx-auto flex max-w-[1440px] items-center justify-center p-12 text-fg-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading client…
      </div>
    );
  }
  if (!client) return null;

  return (
    <div className="mx-auto w-full max-w-[1440px] p-6 md:p-8">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/clients">
          <ArrowLeft className="h-4 w-4" />
          Clients
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-500">
              <Building2 className="h-5 w-5" />
            </div>
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
              {client.companyName}
            </h1>
            {!client.isActive && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100/60 px-2 py-0.5 text-[11px] font-semibold text-fg-muted">
                <Archive className="h-3 w-3" />
                Archived
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-fg-muted">
            {client.type && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-fg-subtle" />
                {client.type}
              </span>
            )}
            {(client.city || client.state) && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-fg-subtle" />
                {[client.city, client.state].filter(Boolean).join(', ')}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-fg-subtle" />
              Added{' '}
              {new Date(client.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {client.isActive ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setArchiveOpen(true)}
              className="text-danger-500 hover:bg-danger-500/10 hover:text-danger-500"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={reactivate} disabled={saving}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main */}
        <div className="space-y-5">
          {/* Company info card */}
          <Card
            title="Company"
            action={
              editing ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      load();
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveClient} disabled={saving}>
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
              <Field label="Company name" required editing={editing} value={companyName} onChange={setCompanyName} display={client.companyName} className="sm:col-span-2" />
              <SelectField
                label="Type"
                editing={editing}
                value={type}
                onChange={setType}
                display={client.type ?? '—'}
                options={CLIENT_TYPES}
              />
              <Field
                label="Address"
                editing={editing}
                value={address}
                onChange={setAddress}
                display={client.address ?? '—'}
                placeholder="123 Main St"
              />
              <Field
                label="City"
                editing={editing}
                value={city}
                onChange={setCity}
                display={client.city ?? '—'}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field label="State" editing={editing} value={state} onChange={(v) => setState(v.toUpperCase())} display={client.state ?? '—'} maxLength={2} />
                <Field label="ZIP" editing={editing} value={zipCode} onChange={setZipCode} display={client.zipCode ?? '—'} />
              </div>
            </div>
          </Card>

          {/* Contacts card */}
          <Card
            title="Contacts"
            action={
              <Button
                size="sm"
                onClick={() => {
                  setEditingContact(null);
                  setContactDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add contact
              </Button>
            }
          >
            {contacts.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-sunken/40 px-4 py-6 text-center text-[12.5px] text-fg-subtle">
                No contacts yet — add one to track who to call/email at this company.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-navy-800 text-[11px] font-bold text-white">
                      {c.name
                        .split(' ')
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-fg-default">{c.name}</div>
                        {c.isPrimary && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-blue-500">
                            <Star className="h-2.5 w-2.5" fill="currentColor" />
                            Primary
                          </span>
                        )}
                      </div>
                      {c.role && <div className="text-[11.5px] text-fg-muted">{c.role}</div>}
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-fg-muted">
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="inline-flex items-center gap-1 hover:text-blue-500"
                          >
                            <Mail className="h-3 w-3" />
                            {c.email}
                          </a>
                        )}
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="inline-flex items-center gap-1 hover:text-blue-500"
                          >
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      {!c.isPrimary && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Set as primary"
                          onClick={() => setPrimary(c.id)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => {
                          setEditingContact(c);
                          setContactDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove"
                        className="text-fg-muted hover:text-danger-500"
                        onClick={() => handleContactDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {editing && (
              <div className="mt-4 rounded-md border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[11.5px] text-warn-500">
                You have unsaved changes. Click <strong>Save</strong> on the Company card to persist them.
              </div>
            )}
          </Card>

          {/* Bids card */}
          <Card title={`Bids (${client._count.bids})`}>
            {client.bids.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-sunken/40 px-4 py-6 text-center text-[12.5px] text-fg-subtle">
                No bids from this client yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {client.bids.map((b) => {
                  const meta = STATUS_META[b.status] ?? STATUS_META.new;
                  return (
                    <li key={b.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/bids/${b.id}`}
                        className="flex items-center gap-3 transition-colors hover:text-blue-500"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-fg-default">
                            {b.projectName}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-fg-muted">
                            {b.bidNumber}
                            {b.responseDeadline && (
                              <>
                                {' · Due '}
                                {new Date(b.responseDeadline).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: '2-digit',
                                })}
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.bg} ${meta.text}`}
                        >
                          {meta.label}
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 text-fg-subtle" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <Card title="Stats">
            <dl className="space-y-2 text-[12.5px]">
              <Row label="Total bids">{client._count.bids}</Row>
              <Row label="Contacts">{contacts.length}</Row>
              <Row label="Created">
                {new Date(client.createdAt).toLocaleDateString('en-US')}
              </Row>
              <Row label="Updated">
                {new Date(client.updatedAt).toLocaleDateString('en-US')}
              </Row>
            </dl>
          </Card>

          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 text-[12px] leading-relaxed text-fg-muted">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-500">
              Tip
            </div>
            When the AI bid-capture starts running (Phase 1.5B), unmatched senders
            will create new client drafts here automatically. You&apos;ll review and
            confirm them.
          </div>
        </aside>
      </div>

      {/* Contact dialog */}
      <ContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        contact={editingContact}
        onSave={handleContactSaved}
      />

      {/* Archive confirmation */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this client?</DialogTitle>
            <DialogDescription>
              {client.companyName} will be hidden from the active list. Their{' '}
              {client._count.bids} bid{client._count.bids === 1 ? '' : 's'} stay
              accessible. You can reactivate later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archive} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- helpers ---------- */

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
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

function Field({
  label,
  required,
  editing,
  value,
  onChange,
  display,
  placeholder,
  className,
  maxLength,
}: {
  label: string;
  required?: boolean;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  display: React.ReactNode;
  placeholder?: string;
  className?: string;
  maxLength?: number;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-danger-500">*</span>}
      </Label>
      {editing ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      ) : (
        <div className="rounded-md border border-border bg-sunken/40 px-3 py-2 text-[13px] text-fg-default">
          {display}
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  editing,
  value,
  onChange,
  display,
  options,
}: {
  label: string;
  editing: boolean;
  value: string;
  onChange: (v: string) => void;
  display: React.ReactNode;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {editing ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Pick a type" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="rounded-md border border-border bg-sunken/40 px-3 py-2 text-[13px] text-fg-default">
          {display}
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-semibold text-fg-default">{children}</dd>
    </div>
  );
}

/* ---------- Contact dialog ---------- */
function ContactDialog({
  open,
  onOpenChange,
  contact,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: Contact | null;
  onSave: (c: Contact) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setEmail(contact?.email ?? '');
      setPhone(contact?.phone ?? '');
      setRole(contact?.role ?? '');
      setIsPrimary(contact?.isPrimary ?? false);
    }
  }, [open, contact]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 1) {
      toast.error('Contact name is required');
      return;
    }
    onSave({
      id: contact?.id ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      role: role.trim() || null,
      isPrimary,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{contact ? 'Edit contact' : 'Add contact'}</DialogTitle>
          <DialogDescription>
            Changes will be saved when you click <strong>Save</strong> on the Company card.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>
              Name <span className="text-danger-500">*</span>
            </Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Role / title</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Project Manager" />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-[15px] w-[15px] cursor-pointer accent-blue-500"
            />
            Mark as primary contact
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-3.5 w-3.5" />
              {contact ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
