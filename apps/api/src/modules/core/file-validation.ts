import type { DocumentKind, UploadPolicy } from '@empgt/contracts';
import { env } from '../../config/env.js';

// Contrôle des fichiers déposés : le type est déterminé à partir du contenu
// (signature binaire), jamais à partir de l'extension ou du type déclaré par le navigateur.

export const PDF = 'application/pdf';
export const PNG = 'image/png';
export const JPEG = 'image/jpeg';
export const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const EXTENSIONS: Record<string, string> = { [PDF]: '.pdf', [PNG]: '.png', [JPEG]: '.jpg', [DOCX]: '.docx' };

/** Types acceptés par nature de document. */
const ALLOWED_BY_KIND: Partial<Record<DocumentKind, string[]>> = {
  CV: [PDF, DOCX],
  INVOICE: [PDF],
  SIGNED_CONTRACT: [PDF],
  SIGNED_AMENDMENT: [PDF],
};
const DEFAULT_ALLOWED = [PDF, PNG, JPEG];

export function allowedTypesFor(kind: DocumentKind): string[] {
  return ALLOWED_BY_KIND[kind] ?? DEFAULT_ALLOWED;
}

export function uploadPolicy(kind?: DocumentKind): UploadPolicy {
  const types = kind ? allowedTypesFor(kind) : [PDF, PNG, JPEG, DOCX];
  return {
    maxBytes: env().UPLOAD_MAX_MB * 1024 * 1024,
    allowedMimeTypes: types,
    allowedExtensions: types.map((t) => EXTENSIONS[t]!).filter(Boolean),
  };
}

export function sniffMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return PDF;
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return PNG;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return JPEG;
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    // Conteneur ZIP : n'est accepté que s'il s'agit d'un document Word (DOCX).
    const content = buffer.toString('latin1');
    if (content.includes('[Content_Types].xml') && content.includes('word/')) return DOCX;
  }
  return null;
}

/** Nom de fichier sûr pour l'en-tête Content-Disposition. */
export function safeFilename(name: string, mimeType: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  const ext = EXTENSIONS[mimeType] ?? '';
  if (!base) return `document${ext}`;
  return ext && !base.toLowerCase().endsWith(ext) ? `${base}${ext}` : base;
}
