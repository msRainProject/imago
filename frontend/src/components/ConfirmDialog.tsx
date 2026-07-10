import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { t } from '@/i18n/strings';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Visual emphasis: primary uses the default button, danger uses destructive tones. */
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
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        {children ? <div>{children}</div> : null}

        <AlertDialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
