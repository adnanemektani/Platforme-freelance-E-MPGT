import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

// Erreurs métier en français. Règle de confidentialité : une ressource qu'un
// utilisateur n'a pas le droit de voir renvoie 404 (et non 403), pour ne pas
// révéler son existence à une autre organisation.

export const notFound = (what = 'Ressource') => new NotFoundException(`${what} introuvable`);

export const forbidden = (message = "Vous n'avez pas les droits nécessaires pour cette action") =>
  new ForbiddenException(message);

/** Règle métier non satisfaite (transition impossible, prérequis manquant…). */
export const conflict = (message: string) => new ConflictException(message);

export const badRequest = (message: string, details?: string[]) =>
  new BadRequestException({ message, details });

export const unauthorized = (message = 'Authentification requise') => new UnauthorizedException(message);

/** Fonction désactivée tant qu'une décision métier est attendue. */
export const disabledFeature = (message: string) => new ServiceUnavailableException(message);
