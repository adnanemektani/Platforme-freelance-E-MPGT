'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { ApiError } from '@/lib/api';

const control =
  'block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-gray-100 aria-[invalid=true]:border-red-600';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean; required?: boolean }) => ReactNode;
}

/** Champ de formulaire accessible : libellé, aide et erreur reliés au contrôle. */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">
        {label}
        {required && <span className="text-red-700" aria-hidden="true"> *</span>}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && (
        <p id={hintId} className="text-xs text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ''}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={4} {...props} className={`${control} ${props.className ?? ''}`} />;
}

export function Select({ options, placeholder, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { options: Array<{ value: string; label: string }>; placeholder?: string }) {
  return (
    <select {...props} className={`${control} ${props.className ?? ''}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" {...props} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-500" />
      <label htmlFor={id} className="text-sm text-gray-800">
        {label}
        {hint && <span className="block text-xs text-gray-600">{hint}</span>}
      </label>
    </div>
  );
}

/** Erreur renvoyée par le serveur, avec le détail des champs invalides. */
export function FormError({ error }: { error?: ApiError | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-medium">{error.message}</p>
      {error.details.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {error.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Lecture d'un champ d'un formulaire natif : chaîne vide → null. */
export function formValue(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

export function optionsFrom<T extends string>(values: readonly T[], labels: Record<T, string>): Array<{ value: T; label: string }> {
  return values.map((value) => ({ value, label: labels[value] }));
}
