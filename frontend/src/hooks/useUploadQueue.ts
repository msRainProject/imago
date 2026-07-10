import { useCallback, useRef, useState } from 'react';
import { uploadFile } from '@api/fileManager';
import type { UploadResponse } from '@api/types';

/**
 * Per-file upload state. A single file moves through these stages in order
 * (it can skip `done` and go straight to `error` on failure).
 */
export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  /** 0..100 — derived from XHR progress events. */
  progress: number;
  result: UploadResponse | null;
  error: string | null;
}

interface UploadQueue {
  items: UploadItem[];
  isUploading: boolean;
  add: (files: FileList | File[]) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearCompleted: () => void;
  reset: () => void;
}

let nextId = 1;

export function useUploadQueue(): UploadQueue {
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef<Map<string, AbortController>>(new Map());

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((curr) => curr.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const add = useCallback<UploadQueue['add']>(
    (files) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const newItems: UploadItem[] = list.map((file) => ({
        id: `up_${nextId++}_${file.name}`,
        file,
        status: 'pending',
        progress: 0,
        result: null,
        error: null,
      }));

      setItems((curr) => [...curr, ...newItems]);

      for (const item of newItems) {
        const controller = new AbortController();
        controllers.current.set(item.id, controller);

        updateItem(item.id, { status: 'uploading', error: null });

        uploadFile(item.file, {
          signal: controller.signal,
          onProgress: (loaded, total) => {
            const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
            updateItem(item.id, { progress: pct });
          },
        })
          .then((result) => {
            controllers.current.delete(item.id);
            updateItem(item.id, {
              status: 'done',
              progress: 100,
              result,
              error: null,
            });
          })
          .catch((err: unknown) => {
            controllers.current.delete(item.id);
            if (err instanceof DOMException && err.name === 'AbortError') {
              updateItem(item.id, { status: 'cancelled', error: null });
            } else {
              updateItem(item.id, {
                status: 'error',
                error: err instanceof Error ? err.message : 'Upload failed',
              });
            }
          });
      }
    },
    [updateItem],
  );

  const cancel = useCallback<UploadQueue['cancel']>((id) => {
    const ctrl = controllers.current.get(id);
    if (ctrl) {
      ctrl.abort();
      controllers.current.delete(id);
    } else {
      updateItem(id, { status: 'cancelled' });
    }
  }, [updateItem]);

  const remove = useCallback<UploadQueue['remove']>((id) => {
    const ctrl = controllers.current.get(id);
    if (ctrl) ctrl.abort();
    controllers.current.delete(id);
    setItems((curr) => curr.filter((it) => it.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems((curr) => curr.filter((it) => it.status === 'uploading' || it.status === 'pending'));
  }, []);

  const reset = useCallback(() => {
    for (const ctrl of controllers.current.values()) ctrl.abort();
    controllers.current.clear();
    setItems([]);
  }, []);

  const isUploading = items.some((it) => it.status === 'uploading' || it.status === 'pending');

  return { items, isUploading, add, cancel, remove, clearCompleted, reset };
}
