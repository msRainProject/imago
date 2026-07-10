/**
 * Hill Images — shared client utilities.
 */

/* ----------------------------- Formatting ------------------------------ */

/** Human-readable byte count, e.g. 1.5 MB / 240 KB. */
export function formatBytes(bytes: number, fractionDigits = 2): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : fractionDigits)} ${units[i]}`;
}

/** Localized date formatter. Defaults to zh-CN. */
export function formatDate(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short date for tables (no time). */
export function formatDateShort(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/* ------------------------------ Clipboard ------------------------------- */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/* ----------------------------- Link formats ----------------------------- */

export interface LinkFormats {
  url: string;
  markdown: string;
  html: string;
  bbcode: string;
}

const FALLBACK_DIMENSIONS = { width: 0, height: 0 };

export function buildLinkFormats(
  url: string,
  filename: string,
  dims: { width: number; height: number } = FALLBACK_DIMENSIONS,
): LinkFormats {
  const safeName = filename.replace(/[\[\]()"]/g, (c) => `\\${c}`);
  const widthAttr = dims.width ? ` width="${dims.width}"` : '';
  const heightAttr = dims.height ? ` height="${dims.height}"` : '';
  return {
    url,
    markdown: `![${safeName}](${url})`,
    html: `<img src="${url}" alt="${safeName}"${widthAttr}${heightAttr}>`,
    bbcode: `[img]${url}[/img]`,
  };
}

/* ------------------------- Filename utilities --------------------------- */

export function basename(path: string): string {
  if (!path) return '';
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

export function dirname(path: string): string {
  if (!path) return '';
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '' : path.slice(0, idx);
}

export function isImageMime(mime: string): boolean {
  return /^image\//i.test(mime);
}
