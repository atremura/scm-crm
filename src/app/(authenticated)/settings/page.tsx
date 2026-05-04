'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Building2,
  MapPin,
  Sliders,
  Sparkles,
  Save,
  Loader2,
  Plus,
  X,
  Locate,
  Mail,
  CheckCircle2,
  AlertCircle,
  Unplug,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CompanyProposalInfoSection } from '@/components/settings/company-proposal-info-section';

type Settings = Record<string, string>;

const DEFAULTS: Settings = {
  company_name: 'JMO GROUP Carpentry',
  company_website: 'jmogroup.com',
  base_address: 'Boston, MA',
  base_latitude: '42.3601',
  base_longitude: '-71.0589',
  max_distance_miles: '100',
  preferred_work_types: 'Finish Carpentry, Siding, Sheet Metal',
  ai_auto_analyze: 'true',

  // Auto-capture rules (Phase 1.5C)
  auto_create_bids: 'false',
  auto_min_confidence: '70',
  auto_allowed_states: 'MA, NH, RI, CT, VT, ME',
  auto_qualified_status: 'qualified', // 'new' or 'qualified'
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [original, setOriginal] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      const merged = { ...DEFAULTS, ...(data.settings ?? {}) };
      setSettings(merged);
      setOriginal(merged);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const dirty = useMemo(
    () => Object.keys(settings).some((k) => settings[k] !== original[k]),
    [settings, original],
  );

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save');
      toast.success('Settings saved');
      const merged = { ...DEFAULTS, ...(data.settings ?? {}) };
      setSettings(merged);
      setOriginal(merged);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function geocodeBase() {
    if (!settings.base_address?.trim()) {
      toast.error('Enter a base address first');
      return;
    }
    setGeocoding(true);
    try {
      const params = new URLSearchParams({
        q: settings.base_address,
        format: 'json',
        limit: '1',
        countrycodes: 'us',
      });
      // Hit Nominatim through our own API would be cleaner, but for a one-off
      // settings utility we go direct (browser-side, with tiny rate).
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        toast.error("Couldn't find that address");
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        toast.error('Invalid geocode result');
        return;
      }
      setSettings((prev) => ({
        ...prev,
        base_latitude: lat.toFixed(4),
        base_longitude: lng.toFixed(4),
      }));
      toast.success(`Resolved to ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Geocoding failed');
    } finally {
      setGeocoding(false);
    }
  }

  // Work types editor — comma-separated string ↔ chip array
  const workTypes = (settings.preferred_work_types ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  function setWorkTypes(arr: string[]) {
    update('preferred_work_types', arr.join(', '));
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-[1440px] items-center justify-center p-12 text-fg-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-5 p-6 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-fg-default">
            Settings
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Tune the rules the CRM uses for distance, AI analysis, and company defaults.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-[12px] text-warn-500">Unsaved changes</span>}
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {/* Company */}
      <Section
        icon={<Building2 className="h-4 w-4" />}
        title="Company"
        description="Brand name and website used in proposals and emails"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Company name">
            <Input
              value={settings.company_name ?? ''}
              onChange={(e) => update('company_name', e.target.value)}
            />
          </FormField>
          <FormField label="Website">
            <Input
              value={settings.company_website ?? ''}
              onChange={(e) => update('company_website', e.target.value)}
              placeholder="example.com"
            />
          </FormField>
        </div>
      </Section>

      {/* Proposal header — company contact info for client-facing exports */}
      <CompanyProposalInfoSection />

      {/* Base location */}
      <Section
        icon={<MapPin className="h-4 w-4" />}
        title="Base location"
        description="Reference point for distance calculations on every bid"
      >
        <div className="space-y-4">
          <FormField label="Base address">
            <div className="flex gap-2">
              <Input
                value={settings.base_address ?? ''}
                onChange={(e) => update('base_address', e.target.value)}
                placeholder="Boston, MA"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={geocodeBase}
                disabled={geocoding}
                title="Resolve address to lat/lng via OpenStreetMap"
              >
                {geocoding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Locate className="h-3.5 w-3.5" />
                )}
                Resolve
              </Button>
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Latitude">
              <Input
                value={settings.base_latitude ?? ''}
                onChange={(e) => update('base_latitude', e.target.value)}
                placeholder="42.3601"
              />
            </FormField>
            <FormField label="Longitude">
              <Input
                value={settings.base_longitude ?? ''}
                onChange={(e) => update('base_longitude', e.target.value)}
                placeholder="-71.0589"
              />
            </FormField>
          </div>
          <p className="text-[11.5px] text-fg-muted">
            Bids are auto-rejected when the project address is farther than the threshold below.
          </p>
        </div>
      </Section>

      {/* Bid rules */}
      <Section
        icon={<Sliders className="h-4 w-4" />}
        title="Bid rules"
        description="Distance threshold and preferred work types"
      >
        <div className="space-y-5">
          <FormField
            label={`Maximum distance from base — currently ${settings.max_distance_miles ?? '0'} mi`}
          >
            <input
              type="range"
              min={10}
              max={500}
              step={5}
              value={settings.max_distance_miles ?? '100'}
              onChange={(e) => update('max_distance_miles', e.target.value)}
              className="w-full cursor-pointer accent-blue-500"
            />
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-fg-subtle">
              <span>10 mi</span>
              <span>500 mi</span>
            </div>
          </FormField>

          <FormField
            label="Preferred work types"
            help="The AI prioritises bids matching these. Press Enter to add."
          >
            <WorkTypeEditor types={workTypes} onChange={setWorkTypes} />
          </FormField>
        </div>
      </Section>

      {/* Gmail — useSearchParams() inside requires a Suspense boundary
          for Next 16 prerender compatibility. */}
      <Suspense fallback={null}>
        <GmailSection />
      </Suspense>

      {/* Auto-capture rules */}
      <Section
        icon={<Zap className="h-4 w-4" />}
        title="Auto-capture rules"
        description="When ON, Gmail sync auto-creates bids that pass your rules — you skip the review step"
      >
        <div className="space-y-5">
          {/* Master switch */}
          <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-sunken/40 px-4 py-3">
            <div>
              <div className="text-[13px] font-semibold text-fg-default">
                Auto-create bids from Gmail
              </div>
              <div className="mt-0.5 text-[11.5px] text-fg-muted">
                When enabled, each synced email that meets the rules below becomes a bid
                automatically. Emails that don&apos;t meet the rules become bids too, but flagged as{' '}
                <span className="font-semibold text-danger-500">auto-rejected</span> with the reason
                noted.
              </div>
            </div>
            <Switch
              checked={settings.auto_create_bids === 'true'}
              onCheckedChange={(v) => update('auto_create_bids', v ? 'true' : 'false')}
            />
          </div>

          {settings.auto_create_bids === 'true' && (
            <>
              <FormField
                label={`Minimum confidence — currently ${settings.auto_min_confidence ?? '70'}%`}
                help="Emails where Claude's extraction confidence is below this threshold fall back to manual review."
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={settings.auto_min_confidence ?? '70'}
                  onChange={(e) => update('auto_min_confidence', e.target.value)}
                  className="w-full cursor-pointer accent-blue-500"
                />
                <div className="mt-1 flex items-center justify-between text-[10.5px] text-fg-subtle">
                  <span>0% (always auto)</span>
                  <span>100% (very strict)</span>
                </div>
              </FormField>

              <FormField
                label="Allowed states (fallback when distance can't be computed)"
                help="Distance is the primary rule. If an email's address can't be geocoded, the state list is the fallback. Press Enter to add."
              >
                <StateEditor
                  states={(settings.auto_allowed_states ?? '')
                    .split(',')
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean)}
                  onChange={(arr) => update('auto_allowed_states', arr.join(', '))}
                />
              </FormField>

              <FormField label="Initial status for auto-accepted bids">
                <div className="inline-flex rounded-md bg-sunken p-0.5">
                  {(['new', 'qualified'] as const).map((s) => {
                    const active = settings.auto_qualified_status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => update('auto_qualified_status', s)}
                        className={`rounded px-3 py-1 text-[12px] font-semibold capitalize transition ${
                          active ? 'bg-surface text-fg-default shadow-sm' : 'text-fg-muted'
                        }`}
                      >
                        {s === 'new'
                          ? 'New (needs manual qualify)'
                          : 'Qualified (straight to takeoff)'}
                      </button>
                    );
                  })}
                </div>
              </FormField>

              <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3 text-[11.5px] leading-relaxed text-fg-muted">
                <div className="mb-1.5 font-semibold text-blue-500">How the rules combine:</div>
                <div className="space-y-1 font-mono text-[11px]">
                  <div>
                    <span className="text-success-500">✓</span> distance ≤{' '}
                    {settings.max_distance_miles ?? '100'} mi →{' '}
                    <span className="text-success-500">ACCEPT</span> (any state)
                  </div>
                  <div>
                    <span className="text-danger-500">✗</span> distance &gt;{' '}
                    {settings.max_distance_miles ?? '100'} mi →{' '}
                    <span className="text-danger-500">REJECT</span> (even if state is allowed)
                  </div>
                  <div>
                    <span className="text-warn-500">?</span> no geocodable address → fallback to
                    state list: state ∈ allowed → <span className="text-success-500">ACCEPT</span>,
                    else <span className="text-danger-500">REJECT</span>
                  </div>
                  <div>
                    <span className="text-warn-500">?</span> confidence &lt;{' '}
                    {settings.auto_min_confidence ?? '70'}% →{' '}
                    <span className="text-fg-muted">needs manual review</span> (not auto-rejected)
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* AI */}
      <Section
        icon={<Sparkles className="h-4 w-4" />}
        title="AI Copilot"
        description="Configure automated analysis on incoming bids"
      >
        <div className="flex items-start justify-between gap-4 rounded-md border border-border bg-sunken/40 px-4 py-3">
          <div>
            <div className="text-[13px] font-semibold text-fg-default">Auto-analyze new bids</div>
            <div className="mt-0.5 text-[11.5px] text-fg-muted">
              When enabled, every new bid runs through the AI for a match score and a recommendation
              as soon as it arrives.
            </div>
          </div>
          <Switch
            checked={settings.ai_auto_analyze === 'true'}
            onCheckedChange={(v) => update('ai_auto_analyze', v ? 'true' : 'false')}
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-500/10 text-blue-500">
          {icon}
        </div>
        <div>
          <h2 className="text-[14.5px] font-semibold text-fg-default">{title}</h2>
          <p className="mt-0.5 text-[12px] text-fg-muted">{description}</p>
        </div>
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function FormField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px] font-semibold text-fg-default">{label}</Label>
      {children}
      {help && <p className="text-[11px] text-fg-muted">{help}</p>}
    </div>
  );
}

function WorkTypeEditor({
  types,
  onChange,
}: {
  types: string[];
  onChange: (types: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const t = draft.trim();
    if (!t) return;
    if (types.some((x) => x.toLowerCase() === t.toLowerCase())) {
      toast.error(`"${t}" already added`);
      return;
    }
    onChange([...types, t]);
    setDraft('');
  }

  function remove(t: string) {
    onChange(types.filter((x) => x !== t));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 px-2.5 py-1 text-[12px] font-semibold text-blue-500"
          >
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              className="grid h-4 w-4 place-items-center rounded-full text-blue-500/70 hover:bg-blue-500/20 hover:text-blue-500"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. Roofing, Drywall…"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

type GmailStatus = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
};

function GmailSection() {
  const search = useSearchParams();
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Surface the result of the OAuth callback (?gmail=success/error)
  useEffect(() => {
    const r = search.get('gmail');
    if (r === 'success') {
      const email = search.get('email');
      toast.success(`Gmail connected${email ? ` as ${email}` : ''}`);
    } else if (r === 'error') {
      toast.error(`Gmail connection failed: ${search.get('reason') ?? 'unknown'}`);
    }
  }, [search]);

  async function load() {
    try {
      const res = await fetch('/api/auth/gmail/status');
      if (res.ok) setStatus(await res.json());
    } catch {}
  }

  useEffect(() => {
    load();
  }, []);

  async function disconnect() {
    if (!confirm('Disconnect Gmail? Future syncs will require reconnecting.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/auth/gmail/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Gmail disconnected');
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Section
      icon={<Mail className="h-4 w-4" />}
      title="Gmail integration"
      description="Connect your Gmail so new bid emails can be captured automatically"
    >
      {!status ? (
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : status.connected ? (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md border border-success-500/30 bg-success-500/5 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-fg-default">
                Connected as <span className="text-success-500">{status.email}</span>
              </div>
              <div className="mt-0.5 text-[11.5px] text-fg-muted">
                Connected{' '}
                {status.connectedAt
                  ? new Date(status.connectedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    })
                  : '—'}
                {status.lastSyncAt &&
                  ` · last sync ${new Date(status.lastSyncAt).toLocaleString('en-US', { month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' })}`}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={disconnect}
              disabled={disconnecting}
              className="text-danger-500 hover:bg-danger-500/10 hover:text-danger-500"
            >
              {disconnecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          </div>
          <p className="text-[11.5px] text-fg-muted">
            Use the <strong>Sync Gmail</strong> button on the Bids page to pull recent bid invites.
            Auto-sync (background polling) ships in a future update — for now it&apos;s on-demand.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-md border border-warn-500/30 bg-warn-500/5 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warn-500" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-fg-default">Not connected yet</div>
              <div className="mt-0.5 text-[11.5px] text-fg-muted">
                Authorize the CRM to read your Gmail (read-only) so it can pull bid invitations and
                run them through the AI extractor.
              </div>
            </div>
          </div>
          <Button asChild>
            <a href="/api/auth/gmail/start">
              <Mail className="h-3.5 w-3.5" />
              Connect Gmail
            </a>
          </Button>
          <p className="text-[10.5px] text-fg-subtle">
            Scopes requested: <span className="font-mono">gmail.readonly</span> + your email
            address. Tokens are stored on your user record and can be revoked here at any time, or
            in your Google account settings.
          </p>
        </div>
      )}
    </Section>
  );
}

/** Two-letter US state code editor — chip list. */
function StateEditor({
  states,
  onChange,
}: {
  states: string[];
  onChange: (arr: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  function add() {
    const s = draft.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(s)) {
      toast.error('Use a 2-letter state code (e.g. MA)');
      return;
    }
    if (states.includes(s)) {
      toast.error(`${s} already in list`);
      return;
    }
    onChange([...states, s]);
    setDraft('');
  }

  function remove(s: string) {
    onChange(states.filter((x) => x !== s));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {states.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 rounded-full bg-success-500/15 px-2.5 py-1 font-mono text-[12px] font-bold text-success-500"
          >
            {s}
            <button
              type="button"
              onClick={() => remove(s)}
              className="grid h-4 w-4 place-items-center rounded-full text-success-500/70 hover:bg-success-500/20 hover:text-success-500"
              aria-label={`Remove ${s}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase().slice(0, 2))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. NY"
          maxLength={2}
          className="uppercase"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}
