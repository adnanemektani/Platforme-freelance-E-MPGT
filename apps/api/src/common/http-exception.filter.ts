import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { ApiErrorBody } from '@empgt/contracts';
import type { Request, Response } from 'express';
import { currentRequestId } from './request-context.js';

// Messages pour les contraintes d'unicité connues (index partiels compris).
const UNIQUE_MESSAGES: Record<string, string> = {
  Application_one_selected_per_mission: 'Un candidat est déjà retenu pour cette mission.',
  Application_missionId_profileId_key: 'Vous avez déjà candidaté à cette mission.',
  Proposal_one_live_per_application: 'Une proposition est déjà en cours pour cette candidature.',
  Contract_one_live_per_mission: 'Un contrat existe déjà pour cette mission (une mission = un poste).',
  Timesheet_one_approved_per_period: 'Un CRA est déjà approuvé pour cette période.',
  Timesheet_one_open_per_period: 'Un CRA est déjà en cours pour cette période.',
  Invoice_freelancer_number_unique: 'Ce numéro de facture a déjà été déposé.',
  Invoice_client_number_unique: 'Ce numéro de facture client a déjà été enregistré.',
  Invoice_one_per_timesheet_and_kind: 'Une facture de ce type existe déjà pour ce CRA.',
  User_email_key: 'Un compte existe déjà avec cette adresse.',
  CompanyMembership_companyId_userId_key: 'Cette personne est déjà membre de l’organisation.',
  Review_contractId_authorRole_key: 'Une évaluation a déjà été déposée pour ce contrat.',
  PaymentWebhookEvent_provider_eventId_key: 'Événement déjà reçu.',
};

const STATUS_LABELS: Record<number, string> = {
  400: 'Requête invalide',
  401: 'Non authentifié',
  403: 'Accès refusé',
  404: 'Introuvable',
  409: 'Conflit',
  413: 'Contenu trop volumineux',
  415: 'Type de fichier non accepté',
  422: 'Données invalides',
  429: 'Trop de tentatives',
  500: 'Erreur interne',
  503: 'Service indisponible',
};

interface DbErrorShape {
  code?: string;
  message?: string;
  meta?: Record<string, unknown>;
  cause?: unknown;
}

function findText(error: unknown, depth = 0): string {
  if (!error || depth > 4) return '';
  const e = error as DbErrorShape & { originalMessage?: string };
  return [e.message ?? '', e.originalMessage ?? '', findText(e.cause, depth + 1), JSON.stringify(e.meta ?? {})].join(' ');
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = currentRequestId();
    const body = this.toBody(exception, req);
    body.requestId = requestId;
    // Seules les erreurs inattendues sont journalisées en erreur (les refus métier sont des réponses normales).
    if (body.statusCode >= 500 && !(exception instanceof HttpException)) {
      // Journal sans contenu de requête (pas de données personnelles ni secrets).
      this.logger.error(
        `${req.method} ${req.path} -> ${body.statusCode} [${requestId}] ${(exception as Error)?.name ?? ''}: ${(exception as Error)?.message ?? ''}`,
        (exception as Error)?.stack,
      );
    }
    if (!res.headersSent) res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, req: Request): ApiErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      let message = exception.message;
      let details: string[] | undefined;
      if (typeof response === 'object' && response !== null) {
        const r = response as { message?: unknown; details?: unknown };
        if (Array.isArray(r.message)) {
          details = r.message.map(String);
          message = 'Certaines informations sont invalides';
        } else if (typeof r.message === 'string') {
          message = r.message;
        }
        if (Array.isArray(r.details)) details = r.details.map(String);
      }
      if (exception instanceof ThrottlerException) message = 'Trop de tentatives. Réessayez dans quelques minutes.';
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) message = 'Fichier ou contenu trop volumineux.';
      return { statusCode: status, error: STATUS_LABELS[status] ?? 'Erreur', message, details };
    }

    const text = findText(exception);
    // Règles d'immuabilité imposées par les triggers PostgreSQL.
    const immutable = /EMPGT_IMMUTABLE:\s*([^"\n]+?)(?:\s+\(|"|$)/.exec(text);
    if (immutable) {
      return { statusCode: 409, error: STATUS_LABELS[409]!, message: `Opération refusée : ${immutable[1]!.trim()}.` };
    }
    const code = (exception as DbErrorShape)?.code;
    if (code === 'P2002' || /duplicate key value violates unique constraint|23505/.test(text)) {
      const constraint = Object.keys(UNIQUE_MESSAGES).find((name) => text.includes(name));
      return {
        statusCode: 409,
        error: STATUS_LABELS[409]!,
        message: constraint ? UNIQUE_MESSAGES[constraint]! : 'Cette valeur existe déjà.',
      };
    }
    if (code === 'P2025') return { statusCode: 404, error: STATUS_LABELS[404]!, message: 'Ressource introuvable' };
    if (code === 'P2003' || /violates foreign key constraint|23503/.test(text)) {
      return { statusCode: 409, error: STATUS_LABELS[409]!, message: 'Cet élément est lié à d’autres données.' };
    }
    if (/violates check constraint|23514/.test(text)) {
      return { statusCode: 409, error: STATUS_LABELS[409]!, message: 'Les valeurs ne respectent pas une règle de cohérence.' };
    }
    if ((exception as { type?: string })?.type === 'entity.too.large') {
      return { statusCode: 413, error: STATUS_LABELS[413]!, message: 'Contenu trop volumineux.' };
    }
    if ((exception as { type?: string })?.type === 'entity.parse.failed') {
      return { statusCode: 400, error: STATUS_LABELS[400]!, message: 'Corps de requête JSON invalide.' };
    }
    void req;
    return { statusCode: 500, error: STATUS_LABELS[500]!, message: 'Une erreur interne est survenue.' };
  }
}
