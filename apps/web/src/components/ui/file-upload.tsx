'use client';

import { useState } from 'react';
import { useApi } from '@/lib/hooks';
import type { DocumentKind, UploadPolicy } from '@empgt/contracts';
import { formatBytes } from '@/lib/format';
import { Field } from './form';

/** Sélection de fichier avec rappel des formats et de la taille acceptés (contrôle définitif côté serveur). */
export function FileInput({ label, kind, required, onChange }: { label: string; kind?: DocumentKind; required?: boolean; onChange: (file: File | null) => void }) {
  const policy = useApi<UploadPolicy>(`/documents/upload-policy${kind ? `?kind=${kind}` : ''}`);
  const [error, setError] = useState<string | null>(null);
  const hint = policy.data ? `Formats : ${policy.data.allowedExtensions.join(', ')} — ${formatBytes(policy.data.maxBytes)} maximum` : undefined;
  return (
    <Field label={label} required={required} hint={hint} error={error}>
      {(props) => (
        <input
          {...props}
          type="file"
          accept={policy.data?.allowedMimeTypes.join(',')}
          className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-800"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && policy.data && file.size > policy.data.maxBytes) {
              setError(`Fichier trop volumineux (${formatBytes(file.size)}).`);
              onChange(null);
              return;
            }
            setError(null);
            onChange(file);
          }}
        />
      )}
    </Field>
  );
}
