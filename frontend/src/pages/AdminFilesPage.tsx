import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Braces,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CodeXml,
  Link2,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  SquareCode,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  batchDeleteFiles,
  deleteFile,
  listFiles,
  renameFile,
} from '@api/fileManager';
import type { ImageItem } from '@api/types';
import { useToast } from '@hooks/useToast';
import { useDebounce } from '@hooks/useDebounce';
import ConfirmDialog from '@components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { t, format } from '@/i18n/strings';
import { buildLinkFormats, copyToClipboard, formatBytes, formatDateShort } from '@/utils/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

interface PageData {
  files: ImageItem[];
  total: number;
  page: number;
  pageSize: number;
}

/* ------------------------------- Page ----------------------------------- */

export default function AdminFilesPage() {
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput.trim(), 300);

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<ImageItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<ImageItem | null>(null);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  /* Reset page when filters change. */
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [debouncedSearch]);

  /* Load. */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFiles({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setData({
        files: res.data,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      });
      // Clear selection on reload.
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.errLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------- Selection helpers ------------------------- */

  const allSelected = useMemo(() => {
    if (!data || data.files.length === 0) return false;
    return data.files.every((f) => selected.has(f.hash));
  }, [data, selected]);

  const toggleAll = () => {
    if (!data) return;
    setSelected((curr) => {
      const next = new Set(curr);
      if (allSelected) {
        for (const f of data.files) next.delete(f.hash);
      } else {
        for (const f of data.files) next.add(f.hash);
      }
      return next;
    });
  };

  const toggleOne = (hash: string) => {
    setSelected((curr) => {
      const next = new Set(curr);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  /* ------------------------- Actions ------------------------- */

  const handleDelete = async (file: ImageItem) => {
    setBusyAction(true);
    try {
      await deleteFile(file.hash);
      toast.success(t.admin.successDelete);
      setConfirmingDelete(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin.errDeleteFailed);
    } finally {
      setBusyAction(false);
    }
  };

  const handleBatchDelete = async () => {
    const hashes = Array.from(selected);
    if (hashes.length === 0) return;
    setBusyAction(true);
    try {
      const res = await batchDeleteFiles(hashes);
      toast.success(format(t.admin.successBatchDelete, { n: res.deleted ?? hashes.length }));
      setConfirmingBatch(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin.errBatchDeleteFailed);
    } finally {
      setBusyAction(false);
    }
  };

  const handleRename = async (file: ImageItem, newname: string) => {
    const currentName = file.name || file.original_name;
    if (!newname || newname === currentName) {
      setRenaming(null);
      return;
    }
    setBusyAction(true);
    try {
      await renameFile(file.hash, newname);
      toast.success(t.admin.successRename);
      setRenaming(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.admin.errRenameFailed);
    } finally {
      setBusyAction(false);
    }
  };

  /* ------------------------- Pagination math ------------------------- */

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.admin.searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm sm:hidden">
          <p className="text-sm text-foreground">{format(t.admin.bulkBar, { n: selected.size })}</p>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setConfirmingBatch(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t.admin.bulkDelete}
          </Button>
        </div>
      )}

      {error ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-destructive">
          <XCircle className="h-8 w-8" />
          <p>{error}</p>
          <Button onClick={load}>{t.common.retry}</Button>
        </Card>
      ) : (
        <>
          <FileTable
            files={data?.files ?? []}
            loading={loading && !data}
            selected={selected}
            allSelected={allSelected}
            onToggleAll={toggleAll}
            onToggleOne={toggleOne}
            onRename={(f) => setRenaming(f)}
            onDelete={(f) => setConfirmingDelete(f)}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={data?.total ?? 0}
            pageSize={data?.pageSize ?? PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}

      {/* Floating batch action bar. */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed inset-x-4 bottom-4 z-30 hidden items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:flex sm:left-auto sm:right-6 sm:max-w-md"
          >
            <p className="text-sm text-foreground">
              {format(t.admin.bulkBar, { n: selected.size })}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                {t.common.cancel}
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmingBatch(true)}>
                <Trash2 className="h-4 w-4" />
                {t.admin.bulkDelete}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmingDelete !== null}
        title={t.admin.confirmDeleteTitle}
        description={
          confirmingDelete ? (
            <span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {confirmingDelete.name}
              </code>{' '}
              {t.admin.confirmDeleteDesc}
            </span>
          ) : null
        }
        tone="danger"
        confirmLabel={t.admin.actionDelete}
        busy={busyAction}
        onConfirm={() => confirmingDelete && void handleDelete(confirmingDelete)}
        onCancel={() => setConfirmingDelete(null)}
      />

      <ConfirmDialog
        open={confirmingBatch}
        title={t.admin.confirmBatchDeleteTitle}
        description={format(t.admin.confirmBatchDeleteDesc, { n: selected.size })}
        tone="danger"
        confirmLabel={t.admin.bulkDelete}
        busy={busyAction}
        onConfirm={() => void handleBatchDelete()}
        onCancel={() => setConfirmingBatch(false)}
      />
      <RenameDialog
        file={renaming}
        busy={busyAction}
        onConfirm={handleRename}
        onCancel={() => setRenaming(null)}
      />
    </div>
  );
}

/* ----------------------------- Header ----------------------------------- */

function PageHeader() {
  return (
    <header className="mb-6 sm:mb-8">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl text-balance">
        {t.admin.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t.admin.subtitle}</p>
    </header>
  );
}

/* ----------------------------- Table ------------------------------------ */

function FileTable({
  files,
  loading,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  onRename,
  onDelete,
}: {
  files: ImageItem[];
  loading: boolean;
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (hash: string) => void;
  onRename: (f: ImageItem) => void;
  onDelete: (f: ImageItem) => void;
}) {
  if (loading && files.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </Card>
    );
  }
  if (!loading && files.length === 0) {
    return (
      <Card className="px-6 py-20 text-center text-sm text-muted-foreground">
        {t.gallery.emptyTitle}
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label={t.admin.selectAll}
                />
              </TableHead>
              <TableHead>{t.admin.colName}</TableHead>
              <TableHead className="hidden w-24 sm:table-cell">{t.admin.colSize}</TableHead>
              <TableHead className="hidden w-32 md:table-cell">{t.admin.colDate}</TableHead>
              <TableHead className="w-16 text-right">{t.admin.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((f) => (
              <Row
                key={f.hash}
                file={f}
                selected={selected.has(f.hash)}
                onToggle={() => onToggleOne(f.hash)}
                onRename={() => onRename(f)}
                onDelete={() => onDelete(f)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function Row({
  file,
  selected,
  onToggle,
  onRename,
  onDelete,
}: {
  file: ImageItem;
  selected: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const displayName = file.name || file.original_name || file.hash.slice(0, 12);

  // Use the Go backend's thumbnail endpoint for the preview
  const thumbUrl = `/api/files/${encodeURIComponent(file.hash)}/thumb`;
  const publicUrl = file.url;
  const links = buildLinkFormats(publicUrl, displayName, {
    width: file.width,
    height: file.height,
  });

  const copyLink = async (value: string, label: string) => {
    const ok = await copyToClipboard(value);
    if (ok) toast.success(`${label}${t.common.copied}`);
    else toast.error(t.common.error);
  };

  return (
    <TableRow className={cn(selected && 'bg-accent/40 hover:bg-accent/40')} data-state={selected ? 'selected' : undefined}>
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={t.admin.selectRow} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted"
          >
            <img
              src={thumbUrl}
              alt={displayName}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 hover:scale-110"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).classList.add('hidden');
              }}
            />
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
          </a>
          <div className="min-w-0">
            <span
              className="block truncate font-mono text-xs text-foreground"
              title={displayName}
            >
              {displayName}
            </span>
            <span
              className="mt-0.5 block max-w-[280px] truncate text-[11px] leading-4 text-muted-foreground/70"
              title={publicUrl}
            >
              {publicUrl}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden tabular-nums text-xs text-muted-foreground sm:table-cell">
        {formatBytes(file.size)}
      </TableCell>
      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
        {formatDateShort(file.uploaded_at)}
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t.admin.colActions}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={() => void copyLink(links.url, t.home.copyDirect)}>
              <Link2 className="h-4 w-4" />
              {t.home.copyDirect}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void copyLink(links.markdown, t.home.copyMarkdown)}>
              <Braces className="h-4 w-4" />
              {t.home.copyMarkdown}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void copyLink(links.html, t.home.copyHtml)}>
              <CodeXml className="h-4 w-4" />
              {t.home.copyHtml}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void copyLink(links.bbcode, t.home.copyBbcode)}>
              <SquareCode className="h-4 w-4" />
              {t.home.copyBbcode}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="h-4 w-4" />
              {t.admin.actionRename}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
              {t.admin.actionDelete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ----------------------------- Pagination ------------------------------- */

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row"
      aria-label="pagination"
    >
      <p className="text-xs text-muted-foreground">
        {format(t.admin.paginationSummary, { from, to, total })}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(1)}
          disabled={!canPrev}
          aria-label={t.admin.paginationFirst}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(page - 1)}
          disabled={!canPrev}
          aria-label={t.admin.paginationPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-3 text-sm tabular-nums text-foreground">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(page + 1)}
          disabled={!canNext}
          aria-label={t.admin.paginationNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onChange(totalPages)}
          disabled={!canNext}
          aria-label={t.admin.paginationLast}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

/* ----------------------------- Rename dialog ---------------------------- */

function RenameDialog({
  file,
  busy,
  onConfirm,
  onCancel,
}: {
  file: ImageItem | null;
  busy: boolean;
  onConfirm: (file: ImageItem, newname: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (file) setName(file.name || file.original_name || '');
  }, [file]);

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.admin.renameTitle}</DialogTitle>
          <DialogDescription>{t.admin.renameHelp}</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
            if (e.key === 'Enter' && !busy && file) void onConfirm(file, name.trim());
          }}
          disabled={busy}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button
            disabled={busy || !name.trim()}
            onClick={() => file && void onConfirm(file, name.trim())}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
