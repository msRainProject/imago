import { useCallback, useEffect, useState } from 'react';
import { Key, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { fetchTokens, createToken, deleteToken } from '@api/admin';
import type { AdminToken } from '@api/types';
import { useToast } from '@hooks/useToast';
import ConfirmDialog from '@components/ConfirmDialog';
import { t } from '@/i18n/strings';
import { formatDate } from '@/utils/format';
import { copyToClipboard } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
      <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">{t.tokens.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.tokens.subtitle}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          {t.tokens.create}
        </Button>
      </header>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-destructive">
            <XCircle className="h-8 w-8" />
            <p>{error}</p>
            <Button onClick={load}>{t.common.retry}</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t.common.loading}
        </div>
      ) : tokens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
            <Key className="h-8 w-8 opacity-40" />
            <p>{'还没有 Token，点击右上角创建一个'}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[500px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.tokens.name}</TableHead>
                  <TableHead className="hidden w-36 sm:table-cell">{t.tokens.lastUsed}</TableHead>
                  <TableHead className="hidden w-36 md:table-cell">{t.tokens.created}</TableHead>
                  <TableHead className="w-20 text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((tok) => (
                  <TableRow key={tok.id}>
                    <TableCell className="font-mono text-sm">{tok.name}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {tok.last_used ? formatDate(tok.last_used) : t.tokens.neverUsed}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {formatDate(tok.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingId(tok.id)}
                        aria-label={t.tokens.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!creating) setShowCreate(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.tokens.create}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.tokens.namePlaceholder}
            disabled={creating}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
              if (e.key === 'Enter' && !creating) void handleCreate();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)} disabled={creating}>
              {t.common.cancel}
            </Button>
            <Button disabled={creating || !newName.trim()} onClick={() => void handleCreate()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.tokens.create}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw token display */}
      <Dialog open={rawToken !== null} onOpenChange={(open) => { if (!open) setRawToken(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.tokens.rawTokenTitle}</DialogTitle>
            <DialogDescription>{t.tokens.rawTokenDesc}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-input bg-muted/40 px-3 py-2 sm:flex-nowrap">
            <code className="flex-1 break-all font-mono text-sm text-primary">{rawToken}</code>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void handleCopyRawToken()}>
              {t.tokens.rawTokenCopy}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRawToken(null)}>{t.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
