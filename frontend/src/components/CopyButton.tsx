import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/utils/format';
import { t } from '@/i18n/strings';

interface CopyButtonProps {
  /** The text to copy. */
  value: string;
  /** Visible label, e.g. "直链" or "Markdown". */
  label: string;
  /** Optional icon to show before the label. */
  icon?: React.ReactNode;
  /** Visual style: `tonal` (default), `text`, `outlined`. */
  variant?: 'tonal' | 'text' | 'outlined';
  /** Called after a successful copy (e.g. to show a toast). */
  onCopied?: () => void;
  /** Called on copy failure. */
  onError?: (err: Error) => void;
  iconOnly?: boolean;
  className?: string;
}

const COPY_FEEDBACK_MS = 1400;

const VARIANT_MAP = {
  tonal: 'secondary',
  text: 'ghost',
  outlined: 'outline',
} as const;

/**
 * One-click copy button. Shows a checkmark briefly on success.
 */
export default function CopyButton({
  value,
  label,
  icon,
  variant = 'tonal',
  onCopied,
  onError,
  iconOnly = false,
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } else {
      onError?.(new Error('Copy failed'));
    }
  };

  return (
    <Button
      type="button"
      variant={VARIANT_MAP[variant]}
      size={iconOnly ? 'icon-sm' : 'sm'}
      onClick={handleClick}
      className={className}
      aria-label={`${t.common.copy} ${label}`}
      title={label}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" />
            {!iconOnly ? t.common.copied : null}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            {icon ?? <Copy className="h-4 w-4" />}
            {!iconOnly ? label : null}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
