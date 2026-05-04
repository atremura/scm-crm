'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Loader2, Save, FileText, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CompanyInfo = {
  id: string;
  name: string;
  baseAddress: string | null;
  phone: string | null;
  email: string | null;
  contactName: string | null;
  logoUrl: string | null;
};

export function CompanyProposalInfoSection() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [original, setOriginal] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/company/logo', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Upload failed');
      setCompany((prev) => (prev ? { ...prev, logoUrl: d.logoUrl } : prev));
      setOriginal((prev) => (prev ? { ...prev, logoUrl: d.logoUrl } : prev));
      toast.success('Logo uploaded');
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeLogo() {
    setUploading(true);
    try {
      const res = await fetch('/api/company/logo', { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? 'Failed to remove logo');
      }
      setCompany((prev) => (prev ? { ...prev, logoUrl: null } : prev));
      setOriginal((prev) => (prev ? { ...prev, logoUrl: null } : prev));
      toast.success('Logo removed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove logo');
    } finally {
      setUploading(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/company');
      if (!res.ok) throw new Error('Failed to load company info');
      const d = await res.json();
      setCompany(d);
      setOriginal(d);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update<K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) {
    setCompany((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const dirty =
    !!company &&
    !!original &&
    (['name', 'baseAddress', 'phone', 'email', 'contactName'] as const).some(
      (k) => company[k] !== original[k],
    );

  async function save() {
    if (!company) return;
    setSaving(true);
    try {
      const res = await fetch('/api/company', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: company.name,
          baseAddress: company.baseAddress,
          phone: company.phone,
          email: company.email,
          contactName: company.contactName,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? 'Failed to save');
      toast.success('Company info saved');
      setCompany(d);
      setOriginal(d);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-500/15 text-blue-400">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-fg-default">Proposal header</h2>
            <p className="mt-0.5 text-[12px] text-fg-muted">
              Company contact info printed on the client-facing proposal export.
            </p>
          </div>
        </div>
        <Button onClick={save} disabled={!dirty || saving || loading} size="sm">
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </header>

      <div className="p-5">
        {loading || !company ? (
          <div className="flex items-center gap-2 text-fg-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="text-[12px]">Loading…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <Input
                value={company.name ?? ''}
                onChange={(e) => update('name', e.target.value)}
                placeholder="AWG Construction Corp"
              />
            </Field>
            <Field label="Contact name">
              <Input
                value={company.contactName ?? ''}
                onChange={(e) => update('contactName', e.target.value || null)}
                placeholder="Weder Pereira"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={company.phone ?? ''}
                onChange={(e) => update('phone', e.target.value || null)}
                placeholder="(781) 654-1451"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={company.email ?? ''}
                onChange={(e) => update('email', e.target.value || null)}
                placeholder="contact@awgconstructions.com"
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                value={company.baseAddress ?? ''}
                onChange={(e) => update('baseAddress', e.target.value || null)}
                placeholder="26 Sky Lane, Leominster, MA 01453"
              />
            </Field>

            <Field label="Logo" className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                {company.logoUrl ? (
                  <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={company.logoUrl}
                      alt="Company logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-md border border-dashed border-border text-fg-subtle">
                    <FileText className="h-5 w-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadLogo(f);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {company.logoUrl ? 'Replace logo' : 'Upload logo'}
                    </Button>
                    {company.logoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={removeLogo}
                        className="text-danger-500 hover:bg-danger-500/10 hover:text-danger-500"
                      >
                        <X className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    )}
                  </div>
                  <span className="text-[11px] text-fg-subtle">
                    PNG, JPG, WebP, or SVG · max 5MB · printed on proposal headers
                  </span>
                </div>
              </div>
            </Field>
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-[12px] font-medium text-fg-muted">{label}</Label>
      {children}
    </div>
  );
}
