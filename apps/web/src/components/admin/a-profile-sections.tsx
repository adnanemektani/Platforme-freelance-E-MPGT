'use client';

import { useId, useState } from 'react';
import {
  labels,
  SkillCategory,
  type AdminProfileView,
  type EducationView,
  type ExperienceView,
} from '@empgt/contracts';
import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import {
  Checkbox,
  Field,
  FormError,
  formValue,
  Input,
  optionsFrom,
  Select,
  Textarea,
} from '@/components/ui/form';
import { periodOf } from './a-shared';

// Édition des rubriques d'un profil historique importé et non rattaché (action « editSections »).
// Chaque enregistrement renvoie la vue d'administration à jour ; la correction humaine est
// verrouillée par le serveur vis-à-vis des imports suivants.

type Props = { profile: AdminProfileView; onChange: (p: AdminProfileView) => void };

export function AProfileSections({ profile, onChange }: Props) {
  return (
    <div className="space-y-8">
      <ASkillsEditor
        key={`skills-${JSON.stringify(profile.skills)}`}
        profile={profile}
        onChange={onChange}
      />
      <ALanguagesEditor
        key={`languages-${JSON.stringify(profile.languages)}`}
        profile={profile}
        onChange={onChange}
      />
      <AItemsEditor kind="experiences" profile={profile} onChange={onChange} />
      <AItemsEditor kind="educations" profile={profile} onChange={onChange} />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{children}</h3>
  );
}

// ── Compétences (remplacement complet) ──────────────────────────────────────

interface SkillRow {
  key: number;
  name: string;
  category: SkillCategory;
  level: string;
  years: string;
}

function ASkillsEditor({ profile, onChange }: Props) {
  const action = useAction();
  const [rows, setRows] = useState<SkillRow[]>(() =>
    profile.skills.map((s, i) => ({
      key: i,
      name: s.name,
      category: s.category,
      level: s.level ?? '',
      years: s.yearsOfExperience === null ? '' : String(s.yearsOfExperience),
    })),
  );
  const [next, setNext] = useState(profile.skills.length);
  const update = (key: number, patch: Partial<SkillRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <section className="space-y-3">
      <SectionTitle>Compétences</SectionTitle>
      {rows.length === 0 && <p className="text-sm text-gray-600">Aucune compétence.</p>}
      <ul className="space-y-2">
        {rows.map((r, index) => (
          <li
            key={r.key}
            className="grid gap-2 rounded-md border border-gray-100 p-2 sm:grid-cols-[2fr_1fr_1fr_6rem_auto] sm:items-end"
          >
            <Field label={`Compétence ${index + 1}`} required>
              {(p) => (
                <Input
                  {...p}
                  value={r.name}
                  maxLength={100}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Catégorie">
              {(p) => (
                <Select
                  {...p}
                  value={r.category}
                  options={optionsFrom(SkillCategory, labels.skillCategory)}
                  onChange={(e) => update(r.key, { category: e.target.value as SkillCategory })}
                />
              )}
            </Field>
            <Field label="Niveau">
              {(p) => (
                <Input
                  {...p}
                  value={r.level}
                  maxLength={50}
                  onChange={(e) => update(r.key, { level: e.target.value })}
                />
              )}
            </Field>
            <Field label="Années">
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  min={0}
                  max={70}
                  value={r.years}
                  onChange={(e) => update(r.key, { years: e.target.value })}
                />
              )}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
            >
              Retirer
            </Button>
          </li>
        ))}
      </ul>
      <FormError error={action.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRows((list) => [
              ...list,
              { key: next, name: '', category: 'TECHNICAL', level: '', years: '' },
            ]);
            setNext((n) => n + 1);
          }}
        >
          Ajouter une compétence
        </Button>
        <Button
          size="sm"
          loading={action.pending}
          onClick={async () => {
            const skills = rows
              .filter((r) => r.name.trim())
              .map((r) => ({
                name: r.name.trim(),
                category: r.category,
                level: r.level.trim() || null,
                yearsOfExperience: r.years.trim() === '' ? null : r.years.trim(),
              }));
            const result = await action.run(
              () =>
                api.put<AdminProfileView>(`/admin/freelancers/${profile.id}/skills`, { skills }),
              { success: 'Compétences enregistrées' },
            );
            if (result) onChange(result);
          }}
        >
          Enregistrer les compétences
        </Button>
      </div>
    </section>
  );
}

// ── Langues (remplacement complet) ──────────────────────────────────────────

interface LanguageRow {
  key: number;
  name: string;
  level: string;
}

function ALanguagesEditor({ profile, onChange }: Props) {
  const action = useAction();
  const [rows, setRows] = useState<LanguageRow[]>(() =>
    profile.languages.map((l, i) => ({ key: i, name: l.name, level: l.level ?? '' })),
  );
  const [next, setNext] = useState(profile.languages.length);
  const update = (key: number, patch: Partial<LanguageRow>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <section className="space-y-3">
      <SectionTitle>Langues</SectionTitle>
      {rows.length === 0 && <p className="text-sm text-gray-600">Aucune langue.</p>}
      <ul className="space-y-2">
        {rows.map((r, index) => (
          <li
            key={r.key}
            className="grid gap-2 rounded-md border border-gray-100 p-2 sm:grid-cols-[2fr_2fr_auto] sm:items-end"
          >
            <Field label={`Langue ${index + 1}`} required>
              {(p) => (
                <Input
                  {...p}
                  value={r.name}
                  maxLength={100}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                />
              )}
            </Field>
            <Field label="Niveau">
              {(p) => (
                <Input
                  {...p}
                  value={r.level}
                  maxLength={100}
                  onChange={(e) => update(r.key, { level: e.target.value })}
                />
              )}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}
            >
              Retirer
            </Button>
          </li>
        ))}
      </ul>
      <FormError error={action.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRows((list) => [...list, { key: next, name: '', level: '' }]);
            setNext((n) => n + 1);
          }}
        >
          Ajouter une langue
        </Button>
        <Button
          size="sm"
          loading={action.pending}
          onClick={async () => {
            const languages = rows
              .filter((r) => r.name.trim())
              .map((r) => ({ name: r.name.trim(), level: r.level.trim() || null }));
            const result = await action.run(
              () =>
                api.put<AdminProfileView>(`/admin/freelancers/${profile.id}/languages`, {
                  languages,
                }),
              { success: 'Langues enregistrées' },
            );
            if (result) onChange(result);
          }}
        >
          Enregistrer les langues
        </Button>
      </div>
    </section>
  );
}

// ── Expériences et formations (ajout, modification, suppression) ────────────

type Kind = 'experiences' | 'educations';
type Item = ExperienceView | EducationView;

const KIND_LABELS: Record<Kind, { title: string; one: string; add: string }> = {
  experiences: { title: 'Expériences', one: 'expérience', add: 'Ajouter une expérience' },
  educations: { title: 'Formations', one: 'formation', add: 'Ajouter une formation' },
};

function AItemsEditor({ kind, profile, onChange }: Props & { kind: Kind }) {
  const items: Item[] = kind === 'experiences' ? profile.experiences : profile.educations;
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [removing, setRemoving] = useState<Item | null>(null);
  const removeAction = useAction();
  const text = KIND_LABELS[kind];

  return (
    <section className="space-y-3">
      <SectionTitle>{text.title}</SectionTitle>
      {items.length === 0 ? (
        <p className="text-sm text-gray-600">Aucune {text.one}.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-100">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
            >
              <span className="min-w-0">
                <span className="block font-medium text-gray-900">{item.title}</span>
                <span className="block text-gray-600">
                  {'organization' in item
                    ? [item.organization, item.location, periodOf(item)].filter(Boolean).join(' · ')
                    : [item.institution, item.periodLabel ?? (item.year ? String(item.year) : null)]
                        .filter(Boolean)
                        .join(' · ')}
                </span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(item)}>
                  Modifier
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(item)}>
                  Supprimer
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
        {text.add}
      </Button>

      {editing && (
        <AItemDialog
          kind={kind}
          item={editing === 'new' ? null : editing}
          profileId={profile.id}
          onClose={() => setEditing(null)}
          onSaved={(result) => {
            setEditing(null);
            onChange(result);
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Supprimer cette ${text.one}`}
        message={
          removing
            ? `« ${removing.title} » sera supprimée du profil. La correction sera conservée lors des imports suivants.`
            : undefined
        }
        confirmLabel="Supprimer"
        tone="danger"
        pending={removeAction.pending}
        onConfirm={async () => {
          if (!removing) return;
          const result = await removeAction.run(
            () =>
              api.delete<AdminProfileView>(
                `/admin/freelancers/${profile.id}/${kind}/${removing.id}`,
              ),
            { success: 'Élément supprimé' },
          );
          if (result) {
            setRemoving(null);
            onChange(result);
          }
        }}
      />
    </section>
  );
}

function AItemDialog({
  kind,
  item,
  profileId,
  onClose,
  onSaved,
}: {
  kind: Kind;
  item: Item | null;
  profileId: string;
  onClose: () => void;
  onSaved: (p: AdminProfileView) => void;
}) {
  const action = useAction();
  const formId = useId();
  const text = KIND_LABELS[kind];
  const exp = item && 'organization' in item ? item : null;
  const edu = item && 'institution' in item ? item : null;

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? `Modifier une ${text.one}` : text.add}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={action.pending}>
            Annuler
          </Button>
          <Button type="submit" form={formId} loading={action.pending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const body: Record<string, unknown> =
            kind === 'experiences'
              ? {
                  title: formValue(form, 'title'),
                  organization: formValue(form, 'organization'),
                  location: formValue(form, 'location'),
                  periodLabel: formValue(form, 'periodLabel'),
                  startYear: formValue(form, 'startYear'),
                  startMonth: formValue(form, 'startMonth'),
                  endYear: formValue(form, 'endYear'),
                  endMonth: formValue(form, 'endMonth'),
                  isCurrent: form.get('isCurrent') === 'on',
                  description: formValue(form, 'description'),
                }
              : {
                  title: formValue(form, 'title'),
                  institution: formValue(form, 'institution'),
                  periodLabel: formValue(form, 'periodLabel'),
                  year: formValue(form, 'year'),
                  description: formValue(form, 'description'),
                };
          if (item) body.position = item.position;
          const base = `/admin/freelancers/${profileId}/${kind}`;
          const result = await action.run(
            () =>
              item
                ? api.patch<AdminProfileView>(`${base}/${item.id}`, body)
                : api.post<AdminProfileView>(base, body),
            {
              success: item ? 'Élément modifié' : 'Élément ajouté',
            },
          );
          if (result) onSaved(result);
        }}
      >
        <Field label="Intitulé" required>
          {(p) => (
            <Input
              {...p}
              name="title"
              defaultValue={item?.title ?? ''}
              maxLength={kind === 'experiences' ? 200 : 300}
            />
          )}
        </Field>
        {kind === 'experiences' ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Organisation">
                {(p) => <Input {...p} name="organization" defaultValue={exp?.organization ?? ''} />}
              </Field>
              <Field label="Lieu">
                {(p) => <Input {...p} name="location" defaultValue={exp?.location ?? ''} />}
              </Field>
            </div>
            <Field
              label="Période (libellé)"
              hint="Ex. « 2019 – 2023 ». Facultatif si les années sont renseignées."
            >
              {(p) => <Input {...p} name="periodLabel" defaultValue={exp?.periodLabel ?? ''} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Année de début">
                {(p) => (
                  <Input
                    {...p}
                    name="startYear"
                    type="number"
                    min={1950}
                    max={2100}
                    defaultValue={exp?.startYear ?? ''}
                  />
                )}
              </Field>
              <Field label="Mois de début">
                {(p) => (
                  <Input
                    {...p}
                    name="startMonth"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={exp?.startMonth ?? ''}
                  />
                )}
              </Field>
              <Field label="Année de fin">
                {(p) => (
                  <Input
                    {...p}
                    name="endYear"
                    type="number"
                    min={1950}
                    max={2100}
                    defaultValue={exp?.endYear ?? ''}
                  />
                )}
              </Field>
              <Field label="Mois de fin">
                {(p) => (
                  <Input
                    {...p}
                    name="endMonth"
                    type="number"
                    min={1}
                    max={12}
                    defaultValue={exp?.endMonth ?? ''}
                  />
                )}
              </Field>
            </div>
            <Checkbox
              name="isCurrent"
              label="Poste actuel"
              defaultChecked={exp?.isCurrent ?? false}
            />
          </>
        ) : (
          <>
            <Field label="Établissement">
              {(p) => <Input {...p} name="institution" defaultValue={edu?.institution ?? ''} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Période (libellé)">
                {(p) => <Input {...p} name="periodLabel" defaultValue={edu?.periodLabel ?? ''} />}
              </Field>
              <Field label="Année">
                {(p) => (
                  <Input
                    {...p}
                    name="year"
                    type="number"
                    min={1950}
                    max={2100}
                    defaultValue={edu?.year ?? ''}
                  />
                )}
              </Field>
            </div>
          </>
        )}
        <Field label="Description">
          {(p) => <Textarea {...p} name="description" defaultValue={item?.description ?? ''} />}
        </Field>
        <FormError error={action.error} />
      </form>
    </Dialog>
  );
}
