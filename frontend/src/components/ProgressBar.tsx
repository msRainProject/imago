import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  /** 0..100 */
  value: number;
  variant?: 'primary' | 'success' | 'error';
  showLabel?: boolean;
  className?: string;
}

const FILL: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  error: 'bg-destructive',
};

/**
 * Linear progress indicator — used for both determinate and
 * indeterminate states. We render the determinate version (a filled
 * track) and use a value of 0 as the "indeterminate" cue.
 */
export default function ProgressBar({
  value,
  variant = 'primary',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        <motion.div
          className={cn('h-full rounded-full', FILL[variant])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        />
      </div>
      {showLabel && (
        <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
