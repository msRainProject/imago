import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { t } from '@/i18n/strings';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual emphasis: primary uses `.md3-btn-filled`, danger uses error tones. */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  /** Disable the confirm button while an async action is in flight. */
  busy?: boolean;
  confirmDisabled?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = t.common.confirm,
  cancelLabel = t.common.cancel,
  tone = 'primary',
  onConfirm,
  onCancel,
  busy = false,
  confirmDisabled = false,
}: ConfirmDialogProps) {
  // Close on ESC.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, busy]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="absolute inset-0 bg-surface-dark/40 backdrop-blur-sm"
            onClick={() => !busy && onCancel()}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="relative w-full max-w-md rounded-md bg-surface-container p-6 shadow-elev-3"
          >
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="absolute right-3 top-3 rounded-full p-1.5 text-surface-on/60 transition-colors duration-md3-short2 ease-md3-standard hover:bg-primary/10 hover:text-surface-on disabled:opacity-30"
              aria-label={t.common.close}
            >
              <X className="h-4 w-4" />
            </button>

            <h2
              id="confirm-dialog-title"
              className="text-title-md text-surface-on"
            >
              {title}
            </h2>
            {description && (
              <div className="mt-2 text-body-md text-surface-on/70">{description}</div>
            )}
            {children && <div className="mt-4">{children}</div>}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="md3-btn-text"
                onClick={onCancel}
                disabled={busy}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={tone === 'danger' ? 'md3-btn-danger' : 'md3-btn-filled'}
                onClick={onConfirm}
                disabled={busy || confirmDisabled}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
