import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Braces,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CodeXml,
  ExternalLink,
  Grid2x2,
  Image as ImageIcon,
  LayoutList,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  SquareCode,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import {
  batchDeleteFiles,
  deleteFile,
  listFiles,
  renameFile,
} from '@api/fileManager';
import type { FileSortMode, ImageItem } from '@api/types';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { t, format } from '@/i18n/strings';
import { buildLinkFormats, copyToClipboard, formatBytes, formatDate } from '@/utils/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const DEFAULT_SORT: FileSortMode = 'date';

type ViewMode = 'table' | 'grid';
type PreviewSource = 'thumb' | 'original';

interface PageData {
  files: ImageItem[];
  total: number;
  page: number;
  pageSize: number;
}

const SORT_OPTIONS: Array<{ value: FileSortMode; label: string; icon: JSX.Element }> = [
  { value: 'date', label: t.admin.sortLatest, icon: <ArrowDownWideNarrow className="h-4 w-4" /> },
  { value: 'size', label: t.admin.sortSize, icon: <ArrowDownWideNarrow className="h-4 w-4" /> },
  { value: 'name', label: t.admin.sortName, icon: <ArrowDownAZ className="h-4 w-4" /> },
];

export default function AdminFilesPage() {
  const toast = useToast();

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput.trim(), 300);
  const [sortMode, setSortMode] = useState<FileSortMode>(DEFAULT_SORT);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [page, setPage] = useState(1);
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<ImageItem | null>(null);
  const [previewSource, setPreviewSource] = useState<PreviewSource>('thumb');
  const [renaming, setRenaming] = useState<ImageItem | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<ImageItem | null>(null);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [debouncedSearch, sortMode]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listFiles({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        sort: sortMode,
      });
      setData({
        files: res.data,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      });
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t.admin.errLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, sortMode]);

  useEffect(() => {
    void load();
  }, [load]);

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

  const openPreview = (file: ImageItem) => {
    setPreviewFile(file);
    setPreviewSource('thumb');
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewSource('thumb');
  };

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

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <PageHeader />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative w-full xl:w-[22rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t.admin.searchPlaceholder}
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,12rem)_auto]">
            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as FileSortMode)}
            >
              <SelectTrigger className="w-full sm:w-[12rem]">
                <SelectValue placeholder={t.admin.sortLabel} />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      {option.icon}
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="inline-flex overflow-hidden rounded-md border border-input bg-background">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'inline-flex h-10 items-center gap-2 px-3 text-sm transition-colors',
                  viewMode === 'table'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
                aria-pressed={viewMode === 'table'}
                aria-label={t.admin.viewTable}
              >
                <LayoutList className="h-4 w-4" />
                {t.admin.viewTable}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'inline-flex h-10 items-center gap-2 border-l border-input px-3 text-sm transition-colors',
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                )}
                aria-pressed={viewMode === 'grid'}
                aria-label={t.admin.viewGrid}
              >
                <Grid2x2 className="h-4 w-4" />
                {t.admin.viewGrid}
              </button>
            </div>
          </div>
        </div>

        <Button asChild variant="secondary" className="w-full xl:w-auto">
          <Link to="/">
            <Upload className="h-4 w-4" />
            {t.admin.uploadShortcut}
          </Link>
        </Button>
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
          {viewMode === 'table' ? (
            <FileTable
              files={data?.files ?? []}
              loading={loading && !data}
              selected={selected}
              allSelected={allSelected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onPreview={openPreview}
              onRename={(f) => setRenaming(f)}
              onDelete={(f) => setConfirmingDelete(f)}
            />
          ) : (
            <FileGrid
              files={data?.files ?? []}
              loading={loading && !data}
              selected={selected}
              allSelected={allSelected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
              onPreview={openPreview}
              onRename={(f) => setRenaming(f)}
              onDelete={(f) => setConfirmingDelete(f)}
            />
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            total={data?.total ?? 0}
            pageSize={data?.pageSize ?? PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="fixed inset-x-4 bottom-4 z-30 hidden items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:flex sm:left-auto sm:right-6 sm:max-w-md"
          >
            <p className="text-sm text-foreground">{format(t.admin.bulkBar, { n: selected.size })}</p>
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

      <PreviewDialog
        file={previewFile}
        source={previewSource}
        onSourceChange={setPreviewSource}
        onClose={closePreview}
      />
    </div>
  );
}

function PageHeader() {
  return (
    <header className="mb-6 sm:mb-8">
      <h1 className="text-balance text-2xl font-semibold text-foreground sm:text-3xl">
        {t.admin.title}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t.admin.subtitle}</p>
    </header>
  );
}

function FileTable({
  files,
  loading,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  onPreview,
  onRename,
  onDelete,
}: {
  files: ImageItem[];
  loading: boolean;
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (hash: string) => void;
  onPreview: (f: ImageItem) => void;
  onRename: (f: ImageItem) => void;
  onDelete: (f: ImageItem) => void;
}) {
  if (loading && files.length === 0) {
    return (
      <Card className="overflow-hidden">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-36" />
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
        <Table className="min-w-[1120px]">
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
              <TableHead className="w-36">{t.admin.colMime}</TableHead>
              <TableHead className="w-24">{t.admin.colDimensions}</TableHead>
              <TableHead className="w-24">{t.admin.colSize}</TableHead>
              <TableHead className="w-44">{t.admin.colDate}</TableHead>
              <TableHead className="w-60 text-right">{t.admin.colActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <FileRow
                key={file.hash}
                file={file}
                selected={selected.has(file.hash)}
                onToggle={() => onToggleOne(file.hash)}
                onPreview={() => onPreview(file)}
                onRename={() => onRename(file)}
                onDelete={() => onDelete(file)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function FileGrid({
  files,
  loading,
  selected,
  allSelected,
  onToggleAll,
  onToggleOne,
  onPreview,
  onRename,
  onDelete,
}: {
  files: ImageItem[];
  loading: boolean;
  selected: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleOne: (hash: string) => void;
  onPreview: (f: ImageItem) => void;
  onRename: (f: ImageItem) => void;
  onDelete: (f: ImageItem) => void;
}) {
  if (loading && files.length === 0) {
    return (
      <Card className="overflow-hidden p-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-border/70">
              <div className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-8 w-full" />
              </div>
            </Card>
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
    <Card className="overflow-hidden p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={allSelected}
            onCheckedChange={onToggleAll}
            aria-label={t.admin.selectAll}
          />
          <span>{t.admin.selectAll}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {format(t.admin.bulkBar, { n: selected.size })}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {files.map((file) => (
          <FileCard
            key={file.hash}
            file={file}
            selected={selected.has(file.hash)}
            onToggle={() => onToggleOne(file.hash)}
            onPreview={() => onPreview(file)}
            onRename={() => onRename(file)}
            onDelete={() => onDelete(file)}
          />
        ))}
      </div>
    </Card>
  );
}

function FileRow({
  file,
  selected,
  onToggle,
  onPreview,
  onRename,
  onDelete,
}: {
  file: ImageItem;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const displayName = file.name || file.original_name || file.hash.slice(0, 12);
  const meta = getFileMeta(file);
  const metaSummary = `${meta.mime} · ${meta.dimensions}`;
  const thumbUrl = file.thumb_url;
  const links = buildLinkFormats(file.url, displayName, {
    width: file.width,
    height: file.height,
  });

  const copyLink = async (value: string, label: string) => {
    const ok = await copyToClipboard(value);
    if (ok) toast.success(`${label}${t.common.copied}`);
    else toast.error(t.common.error);
  };

  return (
    <TableRow
      className={cn(selected && 'bg-accent/40 hover:bg-accent/40')}
      data-state={selected ? 'selected' : undefined}
    >
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={t.admin.selectRow} />
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={onPreview}
          className="flex min-w-0 items-center gap-3 text-left"
          title={t.admin.previewTitle}
        >
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
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
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground hover:text-primary">
              {displayName}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {file.original_name && file.original_name !== displayName
                ? file.original_name
                : metaSummary}
            </span>
          </span>
        </button>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="w-fit max-w-full truncate font-normal">
            {file.mime_type || '—'}
          </Badge>
          <span className="text-xs text-muted-foreground">{metaSummary}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{meta.dimensions}</TableCell>
      <TableCell className="tabular-nums text-xs text-muted-foreground">
        {formatBytes(file.size)}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{formatDate(file.uploaded_at)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void copyLink(links.url, t.admin.previewDirect)}
          >
            <Link2 className="h-4 w-4" />
            {t.home.copyDirect}
          </Button>
          <FileActionMenu
            onRename={onRename}
            onDelete={onDelete}
            onCopyMarkdown={() => void copyLink(links.markdown, t.home.copyMarkdown)}
            onCopyHtml={() => void copyLink(links.html, t.home.copyHtml)}
            onCopyBbcode={() => void copyLink(links.bbcode, t.home.copyBbcode)}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

function FileCard({
  file,
  selected,
  onToggle,
  onPreview,
  onRename,
  onDelete,
}: {
  file: ImageItem;
  selected: boolean;
  onToggle: () => void;
  onPreview: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const displayName = file.name || file.original_name || file.hash.slice(0, 12);
  const meta = getFileMeta(file);
  const metaSummary = `${meta.mime} · ${meta.dimensions}`;
  const thumbUrl = file.thumb_url;
  const links = buildLinkFormats(file.url, displayName, {
    width: file.width,
    height: file.height,
  });

  const copyLink = async (value: string, label: string) => {
    const ok = await copyToClipboard(value);
    if (ok) toast.success(`${label}${t.common.copied}`);
    else toast.error(t.common.error);
  };

  return (
    <Card className={cn('overflow-hidden border-border/70', selected && 'ring-2 ring-primary/30')}>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={t.admin.selectRow} />
          <FileActionMenu
            onRename={onRename}
            onDelete={onDelete}
            onCopyMarkdown={() => void copyLink(links.markdown, t.home.copyMarkdown)}
            onCopyHtml={() => void copyLink(links.html, t.home.copyHtml)}
            onCopyBbcode={() => void copyLink(links.bbcode, t.home.copyBbcode)}
          />
        </div>

        <button
          type="button"
          onClick={onPreview}
          className="group block w-full overflow-hidden rounded-lg bg-muted text-left"
          title={t.admin.previewTitle}
        >
          <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden">
            <img
              src={thumbUrl}
              alt={displayName}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).classList.add('hidden');
              }}
            />
            <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
          </span>
        </button>

        <button
          type="button"
          onClick={onPreview}
          className="group block w-full text-left"
          title={t.admin.previewTitle}
        >
          <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">
            {displayName}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {file.original_name && file.original_name !== displayName
              ? file.original_name
              : metaSummary}
          </span>
        </button>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          <p className="flex items-center justify-between gap-2">
            <span className="truncate">{file.mime_type || '—'}</span>
            <span className="tabular-nums">{formatBytes(file.size)}</span>
          </p>
          <p className="flex items-center justify-between gap-2">
            <span>{meta.dimensions}</span>
            <span>{formatDate(file.uploaded_at)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => void copyLink(links.url, t.admin.previewDirect)}
          >
            <Link2 className="h-4 w-4" />
            {t.home.copyDirect}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function FileActionMenu({
  onRename,
  onDelete,
  onCopyMarkdown,
  onCopyHtml,
  onCopyBbcode,
}: {
  onRename: () => void;
  onDelete: () => void;
  onCopyMarkdown: () => void;
  onCopyHtml: () => void;
  onCopyBbcode: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t.admin.colActions}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onCopyMarkdown}>
          <Braces className="h-4 w-4" />
          {t.home.copyMarkdown}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyHtml}>
          <CodeXml className="h-4 w-4" />
          {t.home.copyHtml}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyBbcode}>
          <SquareCode className="h-4 w-4" />
          {t.home.copyBbcode}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4" />
          {t.admin.actionRename}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          {t.admin.actionDelete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PreviewDialog({
  file,
  source,
  onSourceChange,
  onClose,
}: {
  file: ImageItem | null;
  source: PreviewSource;
  onSourceChange: (value: PreviewSource) => void;
  onClose: () => void;
}) {
  const toast = useToast();

  const copyDirect = async (url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${t.admin.previewDirect}${t.common.copied}`);
    else toast.error(t.common.error);
  };

  return (
    <Dialog
      open={file !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-5xl">
        {file ? (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{t.admin.previewTitle}</DialogTitle>
              <DialogDescription className="space-y-1">
                <span className="block truncate">{file.name || file.original_name || file.hash}</span>
                <span className="block text-xs text-muted-foreground">
                  {file.mime_type || '—'} · {getFileMeta(file).dimensions} · {formatBytes(file.size)} · {formatDate(file.uploaded_at)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg bg-background">
                <img
                  src={source === 'original' ? file.url : file.thumb_url}
                  alt={file.name || file.original_name || file.hash}
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => onSourceChange(source === 'original' ? 'thumb' : 'original')}
                >
                  <ExternalLink className="h-4 w-4" />
                  {source === 'original' ? t.admin.previewThumb : t.admin.previewOriginal}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void copyDirect(file.url)}
                >
                  <Link2 className="h-4 w-4" />
                  {t.admin.previewDirect}
                </Button>
              </div>
              <Button variant="ghost" onClick={onClose}>
                {t.common.close}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function getFileMeta(file: ImageItem): { mime: string; dimensions: string } {
  return {
    mime: file.mime_type || '—',
    dimensions: file.width > 0 && file.height > 0 ? `${file.width}×${file.height}` : '—',
  };
}

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
