import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

const variantStyles: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-900',
  pending: 'bg-amber-100 text-amber-900',
  pending_approval: 'bg-amber-100 text-amber-900',
  rejected: 'bg-rose-100 text-rose-900',
  needs_review: 'bg-sky-100 text-sky-900',
  posted: 'bg-teal-100 text-teal-900',
  reversed: 'bg-stone-200 text-stone-900',
  validated: 'bg-cyan-100 text-cyan-900',
  escalated: 'bg-fuchsia-100 text-fuchsia-900'
};

export function Badge({ value, className }: { value: string; className?: string; children?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
        variantStyles[value] ?? 'bg-black/10 text-ink',
        className
      )}
    >
      {value.replaceAll('_', ' ')}
    </span>
  );
}
