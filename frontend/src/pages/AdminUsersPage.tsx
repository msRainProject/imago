import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, XCircle } from 'lucide-react';
import { fetchUsers, createUser, updateUser, deleteUser } from '@api/admin';
import type { AdminUser } from '@api/types';
import { useToast } from '@hooks/useToast';
import ConfirmDialog from '@components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">{t.users.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.users.subtitle}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t.users.create}
        </Button>
      </header>

      {error ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-12 text-destructive">
          <XCircle className="h-8 w-8" />
          <p>{error}</p>
          <Button onClick={load}>{t.common.retry}</Button>
        </Card>
      ) : loading ? (
        <Card className="flex flex-col gap-3 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="ml-auto h-8 w-20" />
            </div>
          ))}
        </Card>
      ) : users.length === 0 ? (
        <Card className="px-6 py-20 text-center text-sm text-muted-foreground">
          {t.common.noData}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t.users.username}</TableHead>
                  <TableHead className="hidden w-24 sm:table-cell">{t.users.role}</TableHead>
                  <TableHead className="hidden w-36 md:table-cell">{t.users.createdAt}</TableHead>
                  <TableHead className="w-24 text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-mono text-xs">{user.username}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {roleLabel(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(user)}
                          aria-label={t.users.edit}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingId(user.id)}
                          aria-label={t.users.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog
        open={showForm}
        onOpenChange={(next) => {
          if (!next && !submitting) setShowForm(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? t.users.editTitle : t.users.create}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user-form-username">{t.users.usernameLabel}</Label>
              <Input
                id="user-form-username"
                autoFocus
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder={t.users.usernamePlaceholder}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-form-password">{t.users.passwordLabel}</Label>
              <Input
                id="user-form-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={editingId ? t.users.editPasswordHint : t.users.passwordPlaceholder}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.users.roleLabel}</Label>
              <Select
                value={form.role}
                onValueChange={(value) => setForm((f) => ({ ...f, role: value }))}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={submitting}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={submitting || !form.username.trim() || (!editingId && form.password.length < 6)}
              onClick={() => void handleSubmit()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? t.users.edit : t.users.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
