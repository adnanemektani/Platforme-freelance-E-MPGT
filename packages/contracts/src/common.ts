import { z } from 'zod';
import { CurrencyCode } from './enums.js';

// ── Primitives de validation partagées ──────────────────────────────────────

export const uuid = z.uuid({ message: 'Identifiant invalide' });

/** Texte obligatoire, espaces supprimés aux extrémités. */
export const requiredText = (max = 500) =>
  z
    .string({ message: 'Champ obligatoire' })
    .trim()
    .min(1, 'Champ obligatoire')
    .max(max, `${max} caractères maximum`);

/**
 * Valeur facultative : absente (undefined) = inchangée lors d'une modification ;
 * chaîne vide ou null = effacée.
 */
const emptyToNull = <T>(value: T | '' | null | undefined): T | null | undefined =>
  value === undefined ? undefined : value === '' || value === null ? null : value;

/** Texte facultatif : une chaîne vide devient null, un champ absent reste absent. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .nullish()
    .transform(emptyToNull);

/** Motif obligatoire pour les décisions sensibles (refus, intervention administrative…). */
export const reason = z
  .string({ message: 'Un motif est obligatoire' })
  .trim()
  .min(3, 'Un motif explicite est obligatoire (3 caractères minimum)')
  .max(2000, '2000 caractères maximum');

export const email = z
  .string({ message: 'Adresse e-mail obligatoire' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: 'Adresse e-mail invalide' }).max(254));

/** Politique de mot de passe : longueur avant tout (recommandations ANSSI / NIST). */
export const password = z
  .string({ message: 'Mot de passe obligatoire' })
  .min(12, 'Le mot de passe doit comporter au moins 12 caractères')
  .max(128, 'Le mot de passe doit comporter au plus 128 caractères');

export const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^[+0-9 ().-]*$/, 'Numéro de téléphone invalide')
  .nullish()
  .transform(emptyToNull);

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Date calendaire au format AAAA-MM-JJ (sans heure ni fuseau). */
export const isoDate = z
  .string({ message: 'Date obligatoire' })
  .refine(isValidIsoDate, 'Date invalide (format attendu : AAAA-MM-JJ)');

export const optionalIsoDate = z
  .union([isoDate, z.literal(''), z.null()])
  .optional()
  .transform(emptyToNull);

/**
 * Décimal transmis sous forme de chaîne pour éviter les flottants binaires.
 * Accepte « 650 », « 650.5 », « 650,50 » ; renvoie une chaîne normalisée avec un point.
 */
export const decimalString = (options: { scale?: number; max?: number } = {}) => {
  const scale = options.scale ?? 2;
  const pattern = new RegExp(`^\\d{1,12}(\\.\\d{1,${scale}})?$`);
  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim().replace(',', '.'))
    .refine((value) => pattern.test(value), `Nombre décimal invalide (${scale} décimales maximum)`)
    .refine(
      (value) => options.max === undefined || Number(value) <= options.max,
      `Valeur maximale : ${options.max}`,
    );
};

export const optionalDecimalString = (options: { scale?: number; max?: number } = {}) =>
  z
    .union([decimalString(options), z.literal(''), z.null()])
    .optional()
    .transform(emptyToNull);

export const currency = z.enum(CurrencyCode, { message: 'Devise non prise en charge' });

export const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Code pays ISO à deux lettres attendu (ex. FR, MA, CI)');

export const optionalCountryCode = z
  .union([countryCode, z.literal(''), z.null()])
  .optional()
  .transform(emptyToNull);

export const url = z
  .string()
  .trim()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), 'Adresse web invalide (http:// ou https://)');

export const optionalUrl = z
  .union([url, z.literal(''), z.null()])
  .optional()
  .transform(emptyToNull);

// ── Pagination et listes ────────────────────────────────────────────────────

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
});
export type PageQuery = z.infer<typeof pageQuery>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Pagination par curseur (API d'intégration). */
export interface CursorPage<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Actions disponibles (autorisations calculées par le serveur) ────────────

/**
 * Le frontend n'invente aucune règle : chaque objet renvoyé par l'API
 * indique les actions possibles pour l'utilisateur courant et, sinon, pourquoi.
 */
export interface ActionState {
  action: string;
  allowed: boolean;
  /** Motif lisible lorsque l'action est impossible (ou condition à remplir). */
  reason?: string;
}

/** Élément « en attente » affiché sur les tableaux de bord : quoi, pourquoi, quelle action. */
export interface PendingItem {
  code: string;
  title: string;
  description: string;
  severity: 'info' | 'action' | 'blocked';
  link?: string;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: string[];
  requestId?: string;
}

export const reasonBody = z.object({ reason });
export type ReasonBody = z.infer<typeof reasonBody>;

export const optionalReasonBody = z.object({
  reason: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((value) => (value ? value : null)),
});
export type OptionalReasonBody = z.infer<typeof optionalReasonBody>;
