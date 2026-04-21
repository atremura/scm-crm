'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { ClientOption } from './client-combobox';

const CLIENT_TYPES = [
  'General Contractor',
  'Developer',
  'Architect',
  'Property Owner',
  'Other',
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (client: ClientOption) => void;
  initialName?: string;
};

export function NewClientDialog({ open, onOpenChange, onCreated, initialName }: Props) {
  const [companyName, setCompanyName] = useState(initialName ?? '');
  const [type, setType] = useState<string>('General Contractor');
  const [city, setCity] = useState('');
  const [state, setState] = useState('MA');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCompanyName('');
    setType('General Contractor');
    setCity('');
    setState('MA');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (companyName.trim().length < 2) {
      toast.error('Company name is required');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        companyName: companyName.trim(),
        type,
        city: city.trim() || null,
        state: state.trim() || null,
      };
      if (contactName.trim()) {
        body.primaryContact = {
          name: contactName.trim(),
          email: contactEmail.trim() || null,
          phone: contactPhone.trim() || null,
        };
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create client');

      toast.success(`Client "${data.companyName}" created`);
      onCreated(data);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create client');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Create new client</DialogTitle>
          <DialogDescription>
            Quick-create a client without leaving the bid form. You can add more details
            later from the Clients module.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="company-name">
              Company name <span className="text-danger-500">*</span>
            </Label>
            <Input
              id="company-name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Suffolk Construction"
              required
              minLength={2}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_90px]">
            <div className="space-y-1.5">
              <Label htmlFor="client-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="client-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-city">City</Label>
              <Input
                id="client-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Boston"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-state">State</Label>
              <Input
                id="client-state"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="MA"
              />
            </div>
          </div>

          <div className="rounded-md border border-dashed border-border p-3">
            <div className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Primary contact (optional)
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="jane@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(617) 555-0123"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
