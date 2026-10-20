import type { ActionState } from '@empgt/contracts';
import { conflict, forbidden } from './errors.js';

// Les actions disponibles sont calculées par une seule fonction par entité.
// Le même résultat sert (1) à afficher les boutons dans le frontend et
// (2) à autoriser l'opération côté serveur : aucune règle n'est dupliquée.

export const allow = (action: string): ActionState => ({ action, allowed: true });

export const deny = (action: string, reason: string): ActionState => ({ action, allowed: false, reason });

/** Construit une action à partir d'une liste de conditions : la première condition fausse donne le motif. */
export function check(action: string, conditions: Array<[boolean, string]>): ActionState {
  for (const [ok, reason] of conditions) if (!ok) return deny(action, reason);
  return allow(action);
}

/** Marqueur : action inexistante pour ce rôle (non affichée, refusée par 403). */
export const NOT_FOR_ROLE = '__not_for_role__';

export function visibleActions(actions: ActionState[]): ActionState[] {
  return actions.filter((a) => a.reason !== NOT_FOR_ROLE);
}

export function assertAllowed(actions: ActionState[], action: string): void {
  const state = actions.find((a) => a.action === action);
  if (!state || state.reason === NOT_FOR_ROLE) throw forbidden();
  if (!state.allowed) throw conflict(state.reason ?? 'Action impossible dans l’état actuel');
}
