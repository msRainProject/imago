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
import CopyButton from '@components/CopyButton';
import { useDebounce } from '@hooks/useDebounce';
import ConfirmDialog from '@components/ConfirmDialog';
import { t, format } from '@/i18n/strings';
import { buildLinkFormats, formatBytes, formatDateShort } from '@/utils/format';

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
        <div className="md3-input-affix-wrap sm:max-w-xs">
          <span className="md3-input-icon-wrap">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.admin.searchPlaceholder}
            className="md3-input md3-input-leading-icon"
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-surface-container-highest px-4 py-3 shadow-elev-1 sm:hidden">
          <p className="text-body-sm text-surface-on">{format(t.admin.bulkBar, { n: selected.size })}</p>
          <button
            type="button"
            className="md3-btn-danger shrink-0"
            onClick={() => setConfirmingBatch(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t.admin.bulkDelete}
          </button>
        </div>
      )}

      {error ? (
        <div className="md3-card-filled flex flex-col items-center gap-3 px-6 py-12 text-error">
          <XCircle className="h-8 w-8" />
          <p>{error}</p>
          <button type="button" className="md3-btn-filled" onClick={load}>
            {t.common.retry}
          </button>
        </div>
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
            className="fixed inset-x-4 bottom-4 z-30 hidden items-center justify-between gap-2 rounded-md bg-surface-container-highest px-4 py-3 shadow-elev-3 sm:flex sm:left-auto sm:right-6 sm:max-w-md"
          >
            <p className="text-body-md text-surface-on">
              {format(t.admin.bulkBar, { n: selected.size })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="md3-btn-text"
                onClick={() => setSelected(new Set())}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="md3-btn-danger"
                onClick={() => setConfirmingBatch(true)}
              >
                <Trash2 className="h-4 w-4" />
                {t.admin.bulkDelete}
              </button>
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
              <code className="rounded bg-surface-container-high px-1.5 py-0.5 text-body-sm">
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
      <h1 className="text-headline-sm text-surface-on sm:text-headline-md">{t.admin.title}</h1>
      <p className="mt-1 text-body-sm text-surface-on/60 sm:text-body-md">{t.admin.subtitle}</p>
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
      <div className="md3-card-filled flex items-center justify-center gap-2 px-6 py-20 text-body-md text-surface-on/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }
  if (!loading && files.length === 0) {
    return (
      <div className="md3-card-filled px-6 py-20 text-center text-body-md text-surface-on/60">
        {t.gallery.emptyTitle}
      </div>
    );
  }
  return (
    <div className="md3-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-body-md">
          <thead className="bg-surface-container-high text-label-md uppercase tracking-wide text-surface-on/60">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer accent-primary"
                  aria-label={t.admin.selectAll}
                />
              </th>
              <th className="px-3 py-2">{t.admin.colName}</th>
              <th className="hidden w-24 px-3 py-2 sm:table-cell">{t.admin.colSize}</th>
              <th className="hidden w-32 px-3 py-2 md:table-cell">{t.admin.colDate}</th>
              <th className="w-[22rem] px-3 py-2 text-right">{t.admin.colActions}</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
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
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
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
  const handleCopied = (label: string) => {
    toast.success(`${label}${t.common.copied}`);
  };

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={[
        'border-t border-outline-variant/50 transition-colors duration-md3-short2 ease-md3-standard',
        selected ? 'bg-primary-container/40' : 'hover:bg-surface-container-low',
      ].join(' ')}
    >
      <td className="px-3 py-2 align-middle">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 cursor-pointer accent-primary"
          aria-label={t.admin.selectRow}
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface-container-highest"
          >
            <img
              src={thumbUrl}
              alt={displayName}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).classList.add('hidden');
              }}
            />
            <ImageIcon className="h-5 w-5 text-surface-on/40" />
          </a>
          <div className="min-w-0">
            <span
              className="block truncate font-mono text-body-sm text-surface-on"
              title={displayName}
            >
              {displayName}
            </span>
            <span
              className="mt-0.5 block truncate text-[11px] leading-4 text-surface-on/45"
              title={publicUrl}
            >
              {publicUrl}
            </span>
          </div>
        </div>
      </td>
      <td className="hidden px-3 py-2 align-middle tabular-nums text-body-sm text-surface-on/70 sm:table-cell">
        {formatBytes(file.size)}
      </td>
      <td className="hidden px-3 py-2 align-middle text-body-sm text-surface-on/70 md:table-cell">
        {formatDateShort(file.uploaded_at)}
      </td>
      <td className="px-3 py-2 align-middle">
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
            <CopyButton
              value={links.url}
              label={t.home.copyDirect}
              variant="tonal"
              icon={<Link2 className="h-4 w-4" />}
              iconOnly
              className="h-9 w-9 justify-center px-0 py-0"
              onCopied={() => handleCopied(t.home.copyDirect)}
            />
            <CopyButton
              value={links.markdown}
              label={t.home.copyMarkdown}
              variant="tonal"
              icon={<Braces className="h-4 w-4" />}
              iconOnly
              className="h-9 w-9 justify-center px-0 py-0"
              onCopied={() => handleCopied(t.home.copyMarkdown)}
            />
            <CopyButton
              value={links.html}
              label={t.home.copyHtml}
              variant="tonal"
              icon={<CodeXml className="h-4 w-4" />}
              iconOnly
              className="h-9 w-9 justify-center px-0 py-0"
              onCopied={() => handleCopied(t.home.copyHtml)}
            />
            <CopyButton
              value={links.bbcode}
              label={t.home.copyBbcode}
              variant="tonal"
              icon={<SquareCode className="h-4 w-4" />}
              iconOnly
              className="h-9 w-9 justify-center px-0 py-0"
              onCopied={() => handleCopied(t.home.copyBbcode)}
            />
            <button
              type="button"
              className="rounded-full p-2 text-surface-on/60 transition-colors duration-md3-short2 ease-md3-standard hover:bg-primary/10 hover:text-primary"
              onClick={onRename}
              aria-label={t.admin.actionRename}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-full p-2 text-surface-on/60 transition-colors duration-md3-short2 ease-md3-standard hover:bg-error/10 hover:text-error"
              onClick={onDelete}
              aria-label={t.admin.actionDelete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
        </div>
      </td>
    </motion.tr>
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
      <p className="text-label-md text-surface-on/60">
        {format(t.admin.paginationSummary, { from, to, total })}
      </p>
      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onChange(1)}
          disabled={!canPrev}
          aria-label={t.admin.paginationFirst}
        >
          <ChevronsLeft className="h-4 w-4" />
        </PageButton>
        <PageButton
          onClick={() => onChange(page - 1)}
          disabled={!canPrev}
          aria-label={t.admin.paginationPrev}
        >
          <ChevronLeft className="h-4 w-4" />
        </PageButton>
        <span className="px-3 text-body-md tabular-nums text-surface-on">
          {page} / {totalPages}
        </span>
        <PageButton
          onClick={() => onChange(page + 1)}
          disabled={!canNext}
          aria-label={t.admin.paginationNext}
        >
          <ChevronRight className="h-4 w-4" />
        </PageButton>
        <PageButton
          onClick={() => onChange(totalPages)}
          disabled={!canNext}
          aria-label={t.admin.paginationLast}
        >
          <ChevronsRight className="h-4 w-4" />
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full p-2 text-surface-on/70 transition-colors duration-md3-short2 ease-md3-standard hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:pointer-events-none"
      {...rest}
    >
      {children}
    </button>
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
    <AnimatePresence>
      {file && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-surface-dark/40 backdrop-blur-sm"
            onClick={() => !busy && onCancel()}
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className="relative w-full max-w-md rounded-md bg-surface-container p-6 shadow-elev-3"
          >
            <h2 className="text-title-md text-surface-on">{t.admin.renameTitle}</h2>
            <p className="mt-1 text-body-sm text-surface-on/60">{t.admin.renameHelp}</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !busy) void onConfirm(file, name.trim());
                if (e.key === 'Escape' && !busy) onCancel();
              }}
              disabled={busy}
              className="md3-input mt-4"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="md3-btn-text"
                onClick={onCancel}
                disabled={busy}
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="md3-btn-filled"
                disabled={busy || !name.trim()}
                onClick={() => void onConfirm(file, name.trim())}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t.common.save}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
