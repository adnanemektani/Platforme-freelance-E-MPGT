'use client';

import { useState } from 'react';
import type { TimesheetCheck, TimesheetEntryView, TimesheetView } from '@empgt/contracts';
import { api } from '@/lib/api';
import { formatNumber, todayIso } from '@/lib/format';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Field, FormError, Textarea } from '@/components/ui/form';
import { daysBetween, formatDay, formatDayLong, isHoursSyntax, isWeekend, sumHours } from './helpers';

interface Row {
  hours: string;
  comment: string;
}

function rowsFrom(entries: TimesheetEntryView[]): Record<string, Row> {
  return Object.fromEntries(entries.map((e) => [e.date, { hours: e.hours.replace(/\.00$/, '').replace('.', ','), comment: e.comment ?? '' }]));
}

function checksByDate(checks: TimesheetCheck[]): Map<string, TimesheetCheck[]> {
  const map = new Map<string, TimesheetCheck[]>();
  for (const c of checks) {
    if (!c.date) continue;
    map.set(c.date, [...(map.get(c.date) ?? []), c]);
  }
  return map;
}

/** Contrôles de cohérence renvoyés par le serveur (erreurs bloquantes et avertissements). */
export function TimesheetChecks({ checks }: { checks: TimesheetCheck[] }) {
  const errors = checks.filter((c) => c.level === 'error');
  const warnings = checks.filter((c) => c.level === 'warning');
  if (checks.length === 0) return null;
  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Alert tone="danger" title={`${errors.length} erreur(s) à corriger avant la soumission`}>
          <ul className="list-disc pl-5">
            {errors.map((c, i) => (
              <li key={`${c.code}-${c.date ?? i}`}>{c.message}</li>
            ))}
          </ul>
        </Alert>
      )}
      {warnings.length > 0 && (
        <Alert tone="warning" title={`${warnings.length} point(s) à vérifier`}>
          <ul className="list-disc pl-5">
            {warnings.map((c, i) => (
              <li key={`${c.code}-${c.date ?? i}`}>{c.message}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}

/**
 * Saisie des heures d'un CRA : une ligne par jour de la période autorisée, aucune valeur préremplie
 * (aucune journée type supposée). Le jeu complet est enregistré par PUT /timesheets/:id/entries.
 */
export function TimesheetEditor({
  timesheet,
  onSaved,
  onDirtyChange,
}: {
  timesheet: TimesheetView;
  onSaved: (t: TimesheetView) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() => rowsFrom(timesheet.entries));
  const [comment, setComment] = useState(timesheet.freelancerComment ?? '');
  const [dirty, setDirtyState] = useState(false);
  const [today] = useState(todayIso);
  const action = useAction();

  const range = timesheet.allowedRange;
  const days = [...new Set([...(range ? daysBetween(range.from, range.to) : []), ...timesheet.entries.map((e) => e.date)])].sort();
  const byDate = checksByDate(timesheet.checks);
  const values = days.map((d) => rows[d]?.hours ?? '');
  const invalid = days.filter((d) => {
    const v = (rows[d]?.hours ?? '').trim();
    return v !== '' && !isHoursSyntax(v);
  });
  const typedTotal = sumHours(values);
  const filledDays = values.filter((v) => v.trim() !== '').length;

  const setDirty = (value: boolean) => {
    setDirtyState(value);
    onDirtyChange(value);
  };
  const setRow = (date: string, patch: Partial<Row>) => {
    setRows((current) => ({ ...current, [date]: { ...(current[date] ?? { hours: '', comment: '' }), ...patch } }));
    setDirty(true);
  };

  const save = async () => {
    const entries = days
      .filter((d) => (rows[d]?.hours ?? '').trim() !== '')
      .map((d) => ({ date: d, hours: rows[d]!.hours.trim().replace(',', '.'), comment: rows[d]!.comment.trim() || null }));
    const result = await action.run(() => api.put<TimesheetView>(`/timesheets/${timesheet.id}/entries`, { entries, freelancerComment: comment.trim() || null }), {
      success: 'CRA enregistré',
    });
    if (result) {
      setRows(rowsFrom(result.entries));
      setComment(result.freelancerComment ?? '');
      setDirty(false);
      onSaved(result);
    }
  };

  if (!range && timesheet.entries.length === 0) {
    return <Alert tone="warning">Aucune journée n’est saisissable pour ce mois : il est en dehors de la période du contrat.</Alert>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Saisissez uniquement les heures réellement travaillées, en heures décimales (ex. 7,5 pour 7 h 30). Laissez vide les jours non travaillés.
        {range && (
          <>
            {' '}
            Période saisissable : du {formatDayLong(range.from)} au {formatDayLong(range.to)}.
          </>
        )}
      </p>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <div className="hidden grid-cols-[12rem_7rem_1fr] gap-3 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 sm:grid" aria-hidden="true">
          <span>Jour</span>
          <span>Heures</span>
          <span>Commentaire</span>
        </div>
        <ul className="divide-y divide-gray-100">
          {days.map((day) => {
            const row = rows[day] ?? { hours: '', comment: '' };
            const dayChecks = byDate.get(day) ?? [];
            const wrongSyntax = invalid.includes(day);
            const outOfRange = range ? day < range.from || day > range.to : true;
            const label = formatDayLong(day);
            return (
              <li key={day} className={`grid grid-cols-[1fr_7rem] items-center gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[12rem_7rem_1fr] ${isWeekend(day) ? 'bg-gray-50' : 'bg-white'}`}>
                <span className="text-sm text-gray-900">
                  <span className="capitalize">{formatDay(day)}</span>
                  {isWeekend(day) && <span className="ml-1 text-xs text-gray-500">(week-end)</span>}
                  {day > today && <span className="ml-1 text-xs text-gray-500">(à venir)</span>}
                  {outOfRange && <span className="ml-1 text-xs text-red-700">(hors période)</span>}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={`Heures travaillées le ${label}`}
                  aria-invalid={wrongSyntax || dayChecks.some((c) => c.level === 'error') || undefined}
                  value={row.hours}
                  onChange={(e) => setRow(day, { hours: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 aria-[invalid=true]:border-red-600"
                />
                <input
                  type="text"
                  aria-label={`Commentaire du ${label}`}
                  value={row.comment}
                  maxLength={1000}
                  placeholder="Commentaire (facultatif)"
                  onChange={(e) => setRow(day, { comment: e.target.value })}
                  className="col-span-2 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:col-span-1"
                />
                {(wrongSyntax || dayChecks.length > 0) && (
                  <div className="col-span-2 space-y-0.5 text-xs sm:col-span-3">
                    {wrongSyntax && <p className="font-medium text-red-700">Format attendu : nombre d’heures décimal (ex. 7 ou 7,5), 24 h maximum.</p>}
                    {dayChecks.map((c) => (
                      <p key={c.code} className={c.level === 'error' ? 'font-medium text-red-700' : 'text-amber-800'}>
                        {c.message}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <span>
          Total enregistré : <strong>{formatNumber(timesheet.totalHours)} h</strong>
        </span>
        {dirty && (
          <span className="text-amber-800">
            Saisie en cours : {typedTotal !== null ? `${formatNumber(typedTotal)} h` : 'format à corriger'} sur {filledDays} jour(s) — non enregistrée
          </span>
        )}
      </div>

      <Field label="Commentaire général" hint="Facultatif : précisions pour l’entreprise (astreintes, déplacements, absence…).">
        {(p) => (
          <Textarea
            {...p}
            value={comment}
            maxLength={2000}
            rows={3}
            onChange={(e) => {
              setComment(e.target.value);
              setDirty(true);
            }}
          />
        )}
      </Field>

      <FormError error={action.error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={action.pending} disabled={!dirty || invalid.length > 0}>
          Enregistrer le CRA
        </Button>
        {invalid.length > 0 && <span className="text-sm text-red-700">Corrigez le format des heures avant d’enregistrer.</span>}
      </div>
    </div>
  );
}

/** Heures déclarées (lecture seule). */
export function TimesheetEntriesTable({ timesheet }: { timesheet: TimesheetView }) {
  if (timesheet.entries.length === 0) return <p className="text-sm text-gray-600">Aucune heure saisie.</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {timesheet.entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
            <span className="capitalize text-gray-900">{formatDay(e.date)}</span>
            <span className="flex-1 text-gray-700">{e.comment}</span>
            <span className="font-medium tabular-nums text-gray-900">{formatNumber(e.hours)} h</span>
          </li>
        ))}
      </ul>
      <p className="text-sm">
        Total : <strong>{formatNumber(timesheet.totalHours)} h</strong> sur {timesheet.entries.length} jour(s)
      </p>
      {timesheet.freelancerComment && (
        <p className="text-sm text-gray-700">
          <span className="font-medium">Commentaire :</span> {timesheet.freelancerComment}
        </p>
      )}
    </div>
  );
}
