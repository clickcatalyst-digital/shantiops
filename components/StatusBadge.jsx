import { effectiveStatus } from '@/lib/sla';
import { cn } from '@/lib/utils';

// Soft tinted status pill keyed to the status palette (success/warning/danger/blocked/info).
const STYLES = {
  done: 'text-success bg-success/10 ring-success/20',
  overdue: 'text-danger bg-danger/10 ring-danger/20',
  blocked: 'text-blocked bg-blocked/10 ring-blocked/20',
  due_now: 'text-warning bg-warning/10 ring-warning/20',
  due_soon: 'text-warning bg-warning/10 ring-warning/20',
  in_progress: 'text-info bg-info/10 ring-info/20',
  not_started: 'text-muted-foreground bg-muted ring-border',
  gray: 'text-muted-foreground bg-muted ring-border',
};

const DOT = {
  done: 'bg-success', overdue: 'bg-danger', blocked: 'bg-blocked',
  due_now: 'bg-warning', due_soon: 'bg-warning', in_progress: 'bg-info',
  not_started: 'bg-muted-foreground', gray: 'bg-muted-foreground',
};

export default function StatusBadge({ m, status, className }) {
  const s = status || effectiveStatus(m);
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
      STYLES[s.code] || STYLES.gray,
      className
    )}>
      <span className={cn('size-1.5 rounded-full', DOT[s.code] || DOT.gray)} />
      {s.label}
    </span>
  );
}
