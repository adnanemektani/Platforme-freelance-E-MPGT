import type { Db } from './prisma.service.js';

/** Référence lisible et unique, ex. « MIS-2026-0001 » (compteur atomique par préfixe et par année). */
export async function nextReference(db: Db, prefix: 'MIS' | 'PRO' | 'CTR', date = new Date()): Promise<string> {
  const year = date.getUTCFullYear();
  const key = `${prefix}-${year}`;
  const rows = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "ReferenceCounter" (key, value) VALUES (${key}, 1)
    ON CONFLICT (key) DO UPDATE SET value = "ReferenceCounter".value + 1
    RETURNING value`;
  const value = Number(rows[0]!.value);
  return `${key}-${String(value).padStart(4, '0')}`;
}
