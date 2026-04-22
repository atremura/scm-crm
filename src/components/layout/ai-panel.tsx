'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

type Message = {
  role: 'assistant' | 'user';
  text: string;
  list?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

const SUGGESTIONS = [
  "Brief me on today's pipeline",
  'Which bids match our work types?',
  'Summarize the latest bid',
  'What needs attention?',
];

const INITIAL: Message[] = [
  {
    role: 'assistant',
    text: "Hi Andre — I'm reading your pipeline. Want a quick brief on today's top opportunities?",
  },
];

export function AiPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>(INITIAL);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setThinking(true);
    // Placeholder canned reply — wired to real Claude API in Phase 1.5B
    setTimeout(() => {
      const reply = canned(q);
      setMessages((m) => [...m, { role: 'assistant', ...reply }]);
      setThinking(false);
    }, 600);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        role="dialog"
        aria-label="JMO Copilot"
      >
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-gradient-to-br from-navy-800 to-blue-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-fg-default">
              JMO Copilot
            </h3>
            <p className="text-[11.5px] text-fg-muted">
              Trained on your bids, clients & specs · Claude
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-fg-muted hover:bg-sunken hover:text-fg-default"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Demo banner */}
        <div className="border-b border-border bg-warn-500/10 px-5 py-2 text-[11.5px] text-warn-500">
          <strong>Demo mode</strong> — connected to live Claude in Phase 1.5B.
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-sunken text-fg-default'
                  }`}
                >
                  {m.text}
                  {m.list && (
                    <ul className="ml-4 mt-2 list-disc space-y-1 text-[12.5px]">
                      {m.list.map((li, j) => (
                        <li key={j} dangerouslySetInnerHTML={{ __html: li }} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg bg-sunken px-3 py-2 text-[12.5px] text-fg-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5 border-t border-border px-5 py-2.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] text-fg-muted transition-colors hover:border-blue-500/50 hover:text-fg-default"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-border px-3 py-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about a bid, client or metric…"
            className="flex-1 rounded-md border border-transparent bg-sunken px-3 py-2 text-[13px] text-fg-default placeholder:text-fg-subtle focus:border-blue-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => send()}
            className="grid h-9 w-9 place-items-center rounded-md bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            disabled={!input.trim()}
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </>
  );
}

function canned(q: string): { text: string; list?: string[] } {
  const l = q.toLowerCase();
  if (l.includes('brief') || l.includes('pipeline') || l.includes('today')) {
    return {
      text: "Here's the pipeline brief — Apr 21, 2026:",
      list: [
        '<strong>2 active bids</strong> — both visible on the Project Map',
        '<strong>1 in NH</strong> (Claremont, 95.5mi) needs senior review (close to threshold)',
        '<strong>1 due this week</strong> — see the dashboard KPIs',
      ],
    };
  }
  if (l.includes('match') || l.includes('work type')) {
    return {
      text: 'Match analysis is wired to real preferred work types from Settings.',
      list: [
        'Currently configured: Finish Carpentry, Siding, Sheet Metal',
        'Once Phase 1.5B Email AI runs, every captured bid scores against this list',
      ],
    };
  }
  if (l.includes('attention') || l.includes('what needs')) {
    return {
      text: "I'd flag anything overdue, missing assignments, or above the distance threshold.",
      list: [
        'For now, click <strong>Project Map</strong> to see what\'s in/out of range',
        'Bids without an owner will show <em>"—"</em> in the Owner column on the BIDs list',
      ],
    };
  }
  if (l.includes('summarize') || l.includes('latest')) {
    return {
      text: 'Summarisation will use Claude in Phase 1.5B with your bid data + uploaded documents.',
      list: [
        'Right now I can only echo placeholder content',
        'Try: <em>"Brief me on today\'s pipeline"</em> for a static demo',
      ],
    };
  }
  return {
    text: "I'm in demo mode — wired to canned answers until Phase 1.5B.",
    list: ['Try one of the suggestions below.'],
  };
}
