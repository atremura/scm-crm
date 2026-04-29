'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * Inline-edit cell for the EstimateLine table. Click the value → input
 * appears → blur or Enter saves → Escape cancels.
 *
 * The component is "dumb": it only owns the editing state. The parent
 * receives the new numeric value via `onSave` and is responsible for
 * the PATCH call + re-fetch.
 *
 * Props:
 *   value         number | null — the rendered value
 *   format        function that takes the raw number and returns the
 *                 string the user sees when not editing (e.g. dollar
 *                 formatting). Editing mode always shows the raw number.
 *   step          html input step (e.g. "0.01" for dollars, "any" for MH)
 *   onSave        async (newValue: number) => void
 *   placeholder   when value is null
 *   align         "right" | "left"
 *   readOnly      hides the edit affordance entirely
 */
export function EditableCell({
  value,
  format,
  step = 'any',
  onSave,
  placeholder = '—',
  align = 'right',
  readOnly = false,
  width = 'w-20',
  hint,
}: {
  value: number | null;
  format: (v: number) => string;
  step?: string;
  onSave: (newValue: number) => Promise<void> | void;
  placeholder?: string;
  align?: 'right' | 'left';
  readOnly?: boolean;
  width?: string;
  hint?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function commit() {
    const n = parseFloat(draft);
    if (!Number.isFinite(n) || n < 0) {
      setEditing(false);
      return;
    }
    if (value !== null && Math.abs(n - value) < 1e-9) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(n);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        disabled={saving}
        className={`h-6 ${width} rounded border border-blue-500/60 bg-canvas px-1.5 text-${align} font-mono text-[12px] text-fg-default outline-none focus:border-blue-500`}
      />
    );
  }

  if (readOnly) {
    return (
      <span className={`block text-${align} font-mono text-[12px] text-fg-muted`}>
        {value !== null ? format(value) : placeholder}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value !== null ? String(value) : '');
        setEditing(true);
      }}
      title={hint ?? 'Click to edit'}
      className={`block w-full text-${align} font-mono text-[12px] text-fg-default hover:text-blue-400 hover:underline decoration-dotted underline-offset-2`}
    >
      {value !== null ? format(value) : placeholder}
    </button>
  );
}
