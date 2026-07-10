import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Plus, Pencil, Trash2, XCircle } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser } from '@api/admin';
import type { AdminUser } from '@api/types';
import { useToast } from '@hooks/useToast';
import ConfirmDialog from '@components/ConfirmDialog';
import { t } from '@/i18n/strings';
import { formatDate } from '@/utils/format';

const ROLE_OPTIONS = [
  { value: 'admin', label: t.users.admin },
  { value: 'user', label: t.users.user },
] as const;

interface UserFormData {
  username: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserFormData = { username: '', password: '', role: 'user' };

export default function AdminUsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsers();
      setUsers(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.users.errLoad);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (user: AdminUser) => {
    setForm({ username: user.username, password: '', role: user.role });
    setEditingId(user.id);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.username.trim()) return;
    if (!editingId && form.password.length < 6) return;

    setSubmitting(true);
    try {
      if (editingId) {
        const payload: Partial<{ username: string; password: string; role: string }> = {
          username: form.username.trim(),
          role: form.role,
        };
        if (form.password) (payload as Record<string, string>).password = form.password;
        await updateUser(editingId, payload);
        toast.success(t.users.updateSuccess);
      } else {
        await createUser({ username: form.username.trim(), password: form.password, role: form.role });
        toast.success(t.users.createSuccess);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (editingId ? t.users.errUpdate : t.users.errCreate));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyAction(true);
    try {
      await deleteUser(id);
      toast.success(t.users.deleteSuccess);
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.users.errDelete);
    } finally {
      setBusyAction(false);
    }
  };

  const roleLabel = (role: string) => ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:mb-8">
        <div>
          <h2 className="text-title-md text-surface-on sm:text-headline-sm">{t.users.title}</h2>
          <p className="mt-0.5 text-body-sm text-surface-on/60">{t.users.subtitle}</p>
        </div>
        <button type="button" className="md3-btn-filled" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t.users.create}
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
      ) : users.length === 0 ? (
        <div className="md3-card-filled px-6 py-20 text-center text-body-md text-surface-on/60">
          {t.common.noData}
        </div>
      ) : (
        <div className="md3-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-body-md">
              <thead className="bg-surface-container-high text-label-md uppercase tracking-wide text-surface-on/60">
                <tr>
                  <th className="px-4 py-2">{t.users.username}</th>
                  <th className="hidden w-24 px-4 py-2 sm:table-cell">{t.users.role}</th>
                  <th className="hidden w-36 px-4 py-2 md:table-cell">{t.users.createdAt}</th>
                  <th className="w-24 px-4 py-2 text-right">{t.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="border-t border-outline-variant/50 hover:bg-surface-container-low"
                    >
                      <td className="px-4 py-2 font-mono text-body-sm">{user.username}</td>
                      <td className="hidden px-4 py-2 sm:table-cell">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-label-md ${user.role === 'admin' ? 'bg-primary-container text-primary-on-container' : 'bg-surface-container-high text-surface-on/70'}`}>
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="hidden px-4 py-2 text-body-sm text-surface-on/70 md:table-cell">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            type="button"
                            className="rounded-full p-2 text-surface-on/60 transition-colors hover:bg-primary/10 hover:text-primary"
                            onClick={() => openEdit(user)}
                            aria-label={t.users.edit}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-full p-2 text-surface-on/60 transition-colors hover:bg-error/10 hover:text-error"
                            onClick={() => setDeletingId(user.id)}
                            aria-label={t.users.delete}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-surface-dark/40 backdrop-blur-sm" onClick={() => !submitting && setShowForm(false)} aria-hidden />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
              className="relative w-full max-w-md rounded-md bg-surface-container p-6 shadow-elev-3"
            >
              <h2 className="text-title-md text-surface-on">
                {editingId ? t.users.editTitle : t.users.create}
              </h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-label-md text-surface-on/70">{t.users.usernameLabel}</label>
                  <input
                    autoFocus
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder={t.users.usernamePlaceholder}
                    disabled={submitting}
                    className="md3-input"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-label-md text-surface-on/70">{t.users.passwordLabel}</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={editingId ? t.users.editPasswordHint : t.users.passwordPlaceholder}
                    disabled={submitting}
                    className="md3-input"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-label-md text-surface-on/70">{t.users.roleLabel}</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                    disabled={submitting}
                    className="md3-input"
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="md3-btn-text" onClick={() => setShowForm(false)} disabled={submitting}>
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  className="md3-btn-filled"
                  disabled={submitting || !form.username.trim() || (!editingId && form.password.length < 6)}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingId ? t.users.edit : t.users.create}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={deletingId !== null}
        title={t.users.confirmDeleteTitle}
        description={t.users.confirmDeleteDesc}
        tone="danger"
        confirmLabel={t.users.delete}
        busy={busyAction}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
