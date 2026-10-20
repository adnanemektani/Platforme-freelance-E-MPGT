import type { ActionState, OwnProfileView } from '@empgt/contracts';
import { findAction } from '@/components/ui/actions';
import { Alert } from '@/components/ui/feedback';

export interface ProfileSectionProps {
  profile: OwnProfileView;
  /** Vue mise à jour renvoyée par l'API après une modification. */
  onSaved: (profile: OwnProfileView) => void;
}

/** Droit de modification du profil, tel que calculé par le serveur (action « update »). */
export function editState(actions: ActionState[]): { editable: boolean; reason: string | null } {
  const state = findAction(actions, 'update');
  if (!state) return { editable: false, reason: 'La modification du profil n’est pas disponible.' };
  return { editable: state.allowed, reason: state.allowed ? null : (state.reason ?? 'Modification impossible dans l’état actuel du profil.') };
}

/** Bandeau affiché à la place des commandes de modification lorsque le serveur ne les permet pas. */
export function EditLock({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <Alert tone="warning" title="Modification impossible">
      {reason}
    </Alert>
  );
}
