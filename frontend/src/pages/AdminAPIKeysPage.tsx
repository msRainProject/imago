import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { listAppTokens, createAppToken, deleteAppToken } from '@api/admin';
import type { AppToken } from '@api/types';
import { useToast } from '@hooks/useToast';
import ConfirmDialog from '@components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { t } from '@/i18n/strings';
import { formatDate } from '@/utils/format';
import { copyToClipboard } from '@/utils/format';

export default function AdminAPIKeysPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<AppToken[]>([]);
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
      const res = await listAppTokens();
      setKeys(res.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await createAppToken(newName.trim());
      setRawToken(res.api_token);
      setNewName('');
      setShowCreate(false);
      toast.success('创建成功');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyAction(true);
    try {
      await deleteAppToken(id);
      toast.success('已删除');
      setDeletingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setBusyAction(false);
    }
  };

  const handleCopyRawToken = async () => {
    if (!rawToken) return;
    const ok = await copyToClipboard(rawToken);
    if (ok) toast.success(t.common.copied);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:mb-8">
        <div>
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">API 授权</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">管理应用 API Key，每个 Key 独立命名空间上传</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          创建 Key
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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="ml-auto h-8 w-8" />
            </div>
          ))}
        </Card>
      ) : keys.length === 0 ? (
        <Card className="px-6 py-16 text-center text-sm text-muted-foreground">
          还没有 API Key，点击右上角创建一个
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>名称</TableHead>
                  <TableHead className="hidden sm:table-cell">上传次数</TableHead>
                  <TableHead className="hidden md:table-cell">流量</TableHead>
                  <TableHead className="hidden sm:table-cell">最后使用</TableHead>
                  <TableHead className="hidden md:table-cell">创建时间</TableHead>
                  <TableHead className="w-20 text-right">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-mono text-xs">{key.name}</TableCell>
                    <TableCell className="hidden text-xs tabular-nums text-muted-foreground sm:table-cell">
                      {key.upload_count}
                    </TableCell>
                    <TableCell className="hidden text-xs tabular-nums text-muted-foreground md:table-cell">
                      {formatBytes(key.upload_total_bytes)}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {key.last_used ? formatDate(key.last_used) : '从未使用'}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                      {formatDate(key.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeletingId(key.id)}
                        aria-label={t.common.delete}
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
      <Dialog
        open={showCreate}
        onOpenChange={(next) => {
          if (!next && !creating) setShowCreate(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建 API Key</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="应用名称，如 BlogA"
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
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Raw token display */}
      <Dialog
        open={rawToken !== null}
        onOpenChange={(next) => {
          if (!next) setRawToken(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>API Key 已创建</DialogTitle>
            <DialogDescription>请立即复制并妥善保管，此 Key 仅显示一次</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-input bg-muted/40 px-3 py-2 sm:flex-nowrap">
            <code className="flex-1 break-all font-mono text-xs text-primary">{rawToken}</code>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => void handleCopyRawToken()}
            >
              {t.common.copy}
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRawToken(null)}>{t.common.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deletingId !== null}
        title="确认删除"
        description="删除后使用此 Key 的应用将无法继续上传"
        tone="danger"
        confirmLabel={t.common.delete}
        busy={busyAction}
        onConfirm={() => deletingId && void handleDelete(deletingId)}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
}
