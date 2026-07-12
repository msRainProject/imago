import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  CloudUpload,
  ExternalLink,
  FileWarning,
  Loader2,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { fetchStats, fetchUploadOptions } from '@api/public';
import { deleteFile, uploadFile } from '@api/fileManager';
import type { StatsResponse, UploadClientConfig, UploadResponse } from '@api/types';
import { useToast } from '@hooks/useToast';
import ProgressBar from '@components/ProgressBar';
import CopyButton from '@components/CopyButton';
import ConfirmDialog from '@components/ConfirmDialog';
import { t, format } from '@/i18n/strings';
import { basename, buildLinkFormats, formatBytes } from '@/utils/format';
import { isAuthenticated } from '@/utils/auth';
import { processUploadFile } from '@/utils/uploadProcessing';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/* ----------------------------- Public stats ----------------------------- */

function usePublicStats() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStats();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.home.errLoadStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return { stats, loading, error, refresh: load };
}

function useUploadOptions() {
  const [options, setOptions] = useState<UploadClientConfig | null>(null);
  const authed = isAuthenticated();

  useEffect(() => {
    if (!authed) {
      setOptions(null);
      return;
    }
    fetchUploadOptions()
      .then(setOptions)
      .catch(() => {
        setOptions(null);
      });
  }, [authed]);

  return options;
}

/* ----------------------------- Upload queue ----------------------------- */

type UploadStatus = 'pending' | 'processing' | 'uploading' | 'done' | 'error' | 'cancelled';

interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number;
  result: UploadResponse | null;
  error: string | null;
}

let nextUploadId = 1;

/* ------------------------------- Component ------------------------------ */

export default function HomePage() {
  const toast = useToast();
  const stats = usePublicStats();
  const uploadOptions = useUploadOptions();

  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef<Map<string, AbortController>>(new Map());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);

  const authed = isAuthenticated();

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems((curr) => curr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const handleFiles = (files: FileList | File[]) => {
    if (!authed) {
      toast.error('请先登录后再上传');
      return;
    }

    const list = Array.from(files);
    if (list.length === 0) return;
    const uploadOptionsPromise = uploadOptions
      ? Promise.resolve(uploadOptions)
      : fetchUploadOptions().catch(() => null);

    const newItems: UploadItem[] = list.map((file) => ({
      id: `up_${nextUploadId++}_${file.name}`,
      file,
      status: 'pending',
      progress: 0,
      result: null,
      error: null,
    }));

    setItems((curr) => [...curr, ...newItems]);

    for (const item of newItems) {
      void (async () => {
      const controller = new AbortController();
      controllers.current.set(item.id, controller);

        try {
          const resolvedUploadOptions = await uploadOptionsPromise;
          updateItem(item.id, { status: 'processing', error: null, progress: 0 });
          const uploadFileData = await processUploadFile(item.file, resolvedUploadOptions, controller.signal);
          updateItem(item.id, { status: 'uploading', error: null, progress: 0, file: uploadFileData });

          const result = await uploadFile(uploadFileData, {
            signal: controller.signal,
            onProgress: (loaded, total) => {
              const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
              updateItem(item.id, { progress: pct });
            },
          });
          controllers.current.delete(item.id);
          updateItem(item.id, { status: 'done', progress: 100, result, error: null });
        } catch (err: unknown) {
          controllers.current.delete(item.id);
          if (err instanceof DOMException && err.name === 'AbortError') {
            updateItem(item.id, { status: 'cancelled', error: null });
        } else {
          updateItem(item.id, {
            status: 'error',
            error: err instanceof Error ? err.message : String(err ?? 'Upload failed'),
          });
        }
        }
      })();
    }
  };

  useEffect(() => {
    if (!authed) {
      setIsDragging(false);
      dragCounter.current = 0;
      return;
    }
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter.current += 1;
      setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  };

  const cancelItem = (id: string) => {
    const ctrl = controllers.current.get(id);
    if (ctrl) {
      ctrl.abort();
      controllers.current.delete(id);
    } else {
      updateItem(id, { status: 'cancelled' });
    }
  };

  const removeItem = (id: string) => {
    const ctrl = controllers.current.get(id);
    if (ctrl) ctrl.abort();
    controllers.current.delete(id);
    setItems((curr) => curr.filter((it) => it.id !== id));
  };

  const clearCompleted = () => {
    setItems((curr) => curr.filter((it) => it.status === 'uploading' || it.status === 'pending'));
  };

  const isUploading = items.some((it) => it.status === 'uploading' || it.status === 'pending' || it.status === 'processing');
  const done = items.filter((it) => it.status === 'done' && it.result);
  const inFlight = items.filter((it) => it.status === 'uploading' || it.status === 'pending' || it.status === 'processing');
  const failed = items.filter((it) => it.status === 'error' || it.status === 'cancelled');
  const dropHint = format(t.home.dropZoneHint, {
    size: uploadOptions?.max_upload_mb ?? 50,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'group relative block w-full overflow-hidden rounded-xl border-2 border-dashed p-10 text-center transition-all duration-300',
          isDragging
            ? 'scale-[1.01] border-primary bg-primary/10 shadow-lg shadow-primary/10'
            : 'border-border bg-card hover:border-primary/60 hover:bg-primary/5',
        )}
        aria-label={t.home.dropZoneTitle}
      >
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.12),transparent_70%)]"
            aria-hidden
          />
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={onPick}
        />
        <div className="relative flex flex-col items-center gap-3">
          <span
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full transition-colors duration-200',
              isDragging
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground',
            )}
          >
            <CloudUpload className="h-8 w-8" />
          </span>
          <h2 className="text-lg font-semibold text-foreground text-balance">
            {isDragging ? t.home.dropZoneActive : t.home.dropZoneTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{t.home.dropZoneSubtitle}</p>
          <p className="text-xs text-muted-foreground/70">{dropHint}</p>
        </div>
      </button>

      {inFlight.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            {t.home.uploadProgressTitle} ({inFlight.length})
          </h2>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {inFlight.map((it) => (
                <motion.li
                  key={it.id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                >
                  <Card>
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {basename(it.file.name)}
                        </p>
                        {it.status === 'processing' ? (
                          <p className="mt-1.5 text-xs text-muted-foreground">{t.home.uploadPreparing}</p>
                        ) : (
                          <ProgressBar value={it.progress} className="mt-1.5" showLabel />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelItem(it.id)}
                        aria-label={t.home.cancel}
                      >
                        <X className="h-4 w-4" />
                        {t.home.cancel}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </section>
      )}

      {failed.length > 0 && (
        <section className="mt-4">
          <ul className="flex flex-col gap-1">
            {failed.map((it) => (
              <li
                key={it.id}
                className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <FileWarning className="h-4 w-4" />
                <span className="flex-1 truncate">
                  {basename(it.file.name)}
                  {it.error && (
                    <span className="ml-2 opacity-70">— {it.error}</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(it.id)}
                  className="rounded-full p-1 transition-colors hover:bg-destructive/10"
                  aria-label={t.common.close}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-10">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {t.home.uploadCompleteTitle} ({done.length})
            </h2>
            {!isUploading && (
              <Button variant="ghost" size="sm" onClick={clearCompleted}>
                {'清空'}
              </Button>
            )}
          </header>
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {done.map((it) => {
                const result = it.result;
                return result ? (
                  <ResultCard
                    key={it.id}
                    result={result}
                    onDelete={async () => {
                      await deleteFile(result.hash);
                      removeItem(it.id);
                      toast.success('图片已删除');
                    }}
                    onCopy={(label) =>
                      toast.success(format('{label} 已复制到剪贴板', { label }))
                    }
                    onError={(message) => toast.error(message)}
                  />
                ) : null;
              })}
            </AnimatePresence>
          </ul>
        </section>
      )}

      <StatsBar
        stats={stats.stats}
        loading={stats.loading}
        error={stats.error}
        onRefresh={stats.refresh}
      />
    </div>
  );
}

/* --------------------------- Result row -------------------------------- */

function ResultCard({
  result,
  onDelete,
  onCopy,
  onError,
}: {
  result: UploadResponse;
  onDelete: () => Promise<void>;
  onCopy: (label: string) => void;
  onError: (message: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const filename = result.hash.slice(0, 12);
  const links = buildLinkFormats(result.url, filename, {
    width: result.width,
    height: result.height,
  });

  return (
    <>
      <motion.li
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
      >
        <Card>
          <CardContent className="px-4 py-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-w-0 items-center gap-1 text-sm text-foreground hover:underline"
                    >
                      <span className="truncate">{filename}</span>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(result.size)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <CopyButton
                    value={links.url}
                    label={t.home.copyDirect}
                    variant="tonal"
                    onCopied={() => onCopy(t.home.copyDirect)}
                  />
                  <CopyButton
                    value={links.markdown}
                    label={t.home.copyMarkdown}
                    variant="tonal"
                    onCopied={() => onCopy(t.home.copyMarkdown)}
                  />
                  <CopyButton
                    value={links.html}
                    label={t.home.copyHtml}
                    variant="tonal"
                    onCopied={() => onCopy(t.home.copyHtml)}
                  />
                  <CopyButton
                    value={links.bbcode}
                    label={t.home.copyBbcode}
                    variant="tonal"
                    onCopied={() => onCopy(t.home.copyBbcode)}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
                {t.home.delete}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.li>
      <ConfirmDialog
        open={confirming}
        title={t.home.delete}
        description={t.home.confirmDelete}
        tone="danger"
        busy={busy}
        onConfirm={() => {
          void (async () => {
            setBusy(true);
            try {
              await onDelete();
              setConfirming(false);
            } catch (err) {
              onError(err instanceof Error ? err.message : '删除失败');
            } finally {
              setBusy(false);
            }
          })();
        }}
        onCancel={() => !busy && setConfirming(false)}
      />
    </>
  );
}

/* --------------------------- Stats bar --------------------------------- */

function StatsBar({
  stats,
  loading,
  error,
  onRefresh,
}: {
  stats: StatsResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="mt-12">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t.home.statsTitle}</h2>
        <Button variant="ghost" size="sm" onClick={onRefresh} aria-label={t.common.retry}>
          <RefreshCw className="h-4 w-4" />
          {'刷新'}
        </Button>
      </header>
      {error ? (
        <Card>
          <CardContent className="flex items-center gap-2 px-4 py-3 text-sm text-destructive">
            <XCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      ) : loading && !stats ? (
        <Card>
          <CardContent className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.common.loading}
          </CardContent>
        </Card>
      ) : stats ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="图片总数" value={String(stats.total_images)} />
          <Stat label="总大小" value={formatBytes(stats.total_size)} />
          <Stat label="用户数" value={String(stats.total_users)} />
        </div>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
