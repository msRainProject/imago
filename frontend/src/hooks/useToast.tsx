import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { toast, Toaster } from 'sonner';
import { CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

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

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <XCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 text-tertiary" />,
  info: <Info className="h-4 w-4 text-primary" />,
};

function emit(variant: ToastVariant, message: string, duration?: number) {
  const opts = {
    duration: duration === 0 ? Number.POSITIVE_INFINITY : (duration ?? (variant === 'error' ? 5000 : DEFAULT_DURATION)),
    icon: ICONS[variant],
  };
  switch (variant) {
    case 'success':
      toast.success(message, opts);
      break;
    case 'error':
      toast.error(message, opts);
      break;
    case 'warning':
      toast.warning(message, opts);
      break;
    default:
      toast.info(message, opts);
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const api = useMemo<ToastApi>(
    () => ({
      show: (message, opts = {}) => emit(opts.variant ?? 'info', message, opts.duration),
      success: (m, d) => emit('success', m, d),
      error: (m, d) => emit('error', m, d),
      warning: (m, d) => emit('warning', m, d),
      info: (m, d) => emit('info', m, d),
      dismiss: (id: number) => toast.dismiss(id),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          classNames: {
            toast:
              'group rounded-xl border border-border bg-card text-card-foreground shadow-lg',
            title: 'text-sm text-foreground',
            description: 'text-xs text-muted-foreground',
          },
        }}
      />
    </ToastContext.Provider>
  );
}
