import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { t } from '@/i18n/strings';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Auto-dismiss after this many ms. 0 = sticky. */
  duration: number;
}

interface ToastApi {
  show: (message: string, opts?: Partial<Omit<ToastItem, 'id' | 'message'>>) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Returns the toast API; throws if no provider. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const DEFAULT_DURATION = 3000;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((curr) => curr.filter((it) => it.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>((message, opts = {}) => {
    const id = nextId++;
    const item: ToastItem = {
      id,
      message,
      variant: opts.variant ?? 'info',
      duration: opts.duration ?? DEFAULT_DURATION,
    };
    setItems((curr) => [...curr, item]);
    if (item.duration > 0) {
      window.setTimeout(() => dismiss(id), item.duration);
    }
  }, [dismiss]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, d) => show(m, { variant: 'success', duration: d }),
      error: (m, d) => show(m, { variant: 'error', duration: d ?? 5000 }),
      warning: (m, d) => show(m, { variant: 'warning', duration: d }),
      info: (m, d) => show(m, { variant: 'info', duration: d }),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-8"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.div
            key={it.id}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
            className={[
              'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md px-4 py-3 shadow-elev-3',
              TONE[it.variant],
            ].join(' ')}
            role="status"
          >
            <Icon variant={it.variant} />
            <p className="flex-1 text-body-md text-surface-on">{it.message}</p>
            <button
              type="button"
              onClick={() => onDismiss(it.id)}
              className="-mr-1 -mt-1 rounded-full p-1 text-surface-on/60 transition-colors duration-md3-short2 ease-md3-standard hover:bg-surface-on/10 hover:text-surface-on"
              aria-label={t.common.close}
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const TONE: Record<ToastVariant, string> = {
  success: 'bg-success-container text-success-on-container',
  error: 'bg-error-container text-error-on-container',
  warning: 'bg-tertiary-container text-tertiary-on-container',
  info: 'bg-primary-container text-primary-on-container',
};

function Icon({ variant }: { variant: ToastVariant }) {
  const cls = 'h-5 w-5 shrink-0';
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={`${cls} text-success`} />;
    case 'error':
      return <XCircle className={`${cls} text-error`} />;
    case 'warning':
      return <AlertTriangle className={`${cls} text-tertiary`} />;
    default:
      return <Info className={`${cls} text-primary`} />;
  }
}
