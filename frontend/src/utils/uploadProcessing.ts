import type { UploadClientConfig } from '@api/types';

export async function processUploadFile(
  file: File,
  _options: UploadClientConfig | null,
  signal?: AbortSignal,
): Promise<File> {
  if (signal?.aborted) {
    throw new DOMException('Upload aborted', 'AbortError');
  }
  return file;
}
