import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { fetchTokens, createToken, deleteToken } from '@api/admin';
import type { AdminToken } from '@api/types';
import { useToast } from '@hooks/useToast';
import ConfirmDialog from '@components/ConfirmDialog';
import { t } from '@/i18n/strings';
import { formatDate } from '@/utils/format';
import { copyToClipboard } from '@/utils/format';

export default function AdminTokensPage() {
  const toast = useToast();
  const [tokens, setTokens] = useState<AdminToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTokens();
      setTokens(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.tokens.errLoad);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createToken(newName.trim());
      setRawToken(res.token);
      setNewName('');
      setShowCreate(false);
      toast.success(t.tokens.createSuccess);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.tokens.errCreate);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyAction(true);
    try {
      await deleteToken(id);
      toast.success(t.tokens.deleteSuccess);
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.tokens.errDelete);
    } finally {
      setBusyAction(false);
    }
  };

  const handleCopyRawToken = async () => {
    if (!rawToken) return;
    const ok = await copyToClipboard(rawToken);
    if (ok) toast.success(t.common.copied);
  };

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:mb-8">
        <div>
          <h2 className="text-title-md text-surface-on sm:text-headline-sm">{t.tokens.title}</h2>
          <p className="mt-0.5 text-body-sm text-surface-on/60">{t.tokens.subtitle}</p>
        </div>
        <button type="button" className="md3-btn-filled" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          {t.tokens.create}
        </button>
      </header>

      {error ? (
        <div className="md3-card-filled flex flex-col items-center gap-3 px-6 py-12 text-error">
          <XCircle className="h-8 w-8" />
          <p>{error}</p>
          <button type="button" className="md3-btn-filled" onClick={load}>
            {t.common.retry}
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-body-md text-surface-on/60">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.common.loading}
        </div>
      ) : tokens.length === 0 ? (
        <div className="md3-card px-6 py-16 text-center text-body-md text-surface-on/60">
          还没有 Token，点击右上角创建一个
        </div>
      ) : (
        <div className="md3-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-body-md">
              <thead className="bg-surface-container-high text-label-md uppercase tracking-wide text-surface-on/60">
                <tr>
                  <th className="px-4 py-2">{t.tokens.name}</th>
                  <th className="hidden w-36 px-4 py-2 sm:table-cell">{t.tokens.lastUsed}</th>
                  <th className="hidden w-36 px-4 py-2 md:table-cell">{t.tokens.created}</th>
                  <th className="w-20 px-4 py-2 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {tokens.map((tok) => (
                    <motion.tr
                      key={tok.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="border-t border-outline-variant/50 hover:bg-surface-container-low"
                    >
                      <td className="px-4 py-2 font-mono text-body-sm">{tok.name}</td>
                      <td className="hidden px-4 py-2 text-body-sm text-surface-on/70 sm:table-cell">
                        {tok.last_used ? formatDate(tok.last_used) : t.tokens.neverUsed}
                      </td>
                      <td className="hidden px-4 py-2 text-body-sm text-surface-on/70 md:table-cell">
                        {formatDate(tok.created_at)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="rounded-full p-2 text-surface-on/60 transition-colors hover:bg-error/10 hover:text-error"
                          onClick={() => setDeletingId(tok.id)}
                          aria-label={t.tokens.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create dialog */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-surface-dark/40 backdrop-blur-sm" onClick={() => !creating && setShowCreate(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="relative w-full max-w-md rounded-md bg-surface-container p-6 shadow-elev-3"
            >
              <h2 className="text-title-md text-surface-on">{t.tokens.create}</h2>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t.tokens.namePlaceholder}
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) void handleCreate();
                  if (e.key === 'Escape' && !creating) setShowCreate(false);
                }}
                className="md3-input mt-4"
              />
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="md3-btn-text" onClick={() => setShowCreate(false)} disabled={creating}>
                  {t.common.cancel}
                </button>
                <button type="button" className="md3-btn-filled" disabled={creating || !newName.trim()} onClick={() => void handleCreate()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t.tokens.create}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Raw token display */}
      <AnimatePresence>
        {rawToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-surface-dark/40 backdrop-blur-sm" onClick={() => setRawToken(null)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="relative w-full max-w-md rounded-md bg-surface-container p-6 shadow-elev-3"
            >
              <h2 className="text-title-md text-surface-on">{t.tokens.rawTokenTitle}</h2>
              <p className="mt-2 text-body-sm text-surface-on/60">{t.tokens.rawTokenDesc}</p>
              <div className="md3-input mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
                <code className="flex-1 break-all font-mono text-body-sm text-primary">{rawToken}</code>
                <button
                  type="button"
                  className="md3-btn-text shrink-0"
                  onClick={() => void handleCopyRawToken()}
                >
                  {t.tokens.rawTokenCopy}
                </button>
              </div>
              <div className="mt-5 flex justify-end">
                <button type="button" className="md3-btn-filled" onClick={() => setRawToken(null)}>
                  {t.common.close}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deletingId !== null}
        title={t.tokens.confirmDeleteTitle}
        description={t.tokens.confirmDeleteDesc}
        tone="danger"
        confirmLabel={t.tokens.delete}
        busy={busyAction}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
