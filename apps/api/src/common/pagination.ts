import type { Page } from '@empgt/contracts';

export function pageArgs(query: { page: number; pageSize: number }): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}

export function toPage<T>(items: T[], total: number, query: { page: number; pageSize: number }): Page<T> {
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/** Curseur opaque pour la pagination de l'API d'intégration. */
export function encodeCursor(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): Record<string, string> | null {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, string>;
  } catch {
    // curseur invalide : traité comme absent par l'appelant
  }
  return null;
}
