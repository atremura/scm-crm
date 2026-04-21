export function AiScoreBar({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-[12px] text-fg-muted">pending</span>;
  }

  const color =
    score >= 85
      ? 'var(--color-success-500)'
      : score >= 60
        ? 'var(--color-blue-500)'
        : score >= 40
          ? 'var(--color-warn-500)'
          : 'var(--color-danger-500)';

  return (
    <div className="flex min-w-[90px] items-center gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-sunken">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="font-mono text-[12px] font-semibold text-fg-default">
        {score}
      </span>
    </div>
  );
}
