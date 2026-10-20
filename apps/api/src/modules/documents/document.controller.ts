import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DocumentKind,
  documentListQuery,
  optionalReasonBody,
  uploadDocumentSchema,
  verifyDocumentSchema,
  type DocumentListQuery,
  type OptionalReasonBody,
  type UploadDocumentInput,
  type VerifyDocumentInput,
} from '@empgt/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { uploadPolicy } from '../core/file-validation.js';
import { DocumentService, type UploadedFile as Upload } from './document.service.js';

/** Réception en mémoire avec limite de taille : aucun fichier temporaire sur disque. */
export const uploadInterceptor = () =>
  FileInterceptor('file', { limits: { fileSize: env().UPLOAD_MAX_MB * 1024 * 1024, files: 1, fields: 30 } });

const downloadQuery = z.object({ inline: z.stringbool().optional() });
const policyQuery = z.object({ kind: z.enum(DocumentKind).optional() });

export function sendFile(res: Response, file: { stream: NodeJS.ReadableStream; mimeType: string; filename: string; size: number }, inline = false): StreamableFile {
  const canInline = inline && (file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/'));
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Le contenu servi ne peut exécuter aucun script, même affiché dans le navigateur.
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
  return new StreamableFile(file.stream as never, {
    type: file.mimeType,
    length: file.size,
    disposition: `${canInline ? 'inline' : 'attachment'}; filename="${file.filename.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  });
}

@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get('upload-policy')
  @ApiOperation({ summary: 'Formats et taille maximale acceptés' })
  policy(@Query({ schema: policyQuery }) query: z.infer<typeof policyQuery>) {
    return uploadPolicy(query.kind);
  }

  @Get()
  @ApiOperation({ summary: 'Documents visibles par l’utilisateur courant (contrôle côté serveur)' })
  list(@CurrentActor() actor: Actor, @Query({ schema: documentListQuery }) query: DocumentListQuery) {
    return this.documents.list(actor, query);
  }

  @Post()
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiBody({ description: 'Champ « file » + métadonnées (kind, target, targetId, title, expiresAt)' })
  upload(@CurrentActor() actor: Actor, @UploadedFile() file: Upload | undefined, @Body({ schema: uploadDocumentSchema }) body: UploadDocumentInput) {
    return this.documents.upload(actor, file, body);
  }

  @Get(':id')
  get(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(actor, id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Télécharger (accès vérifié et tracé)' })
  async download(
    @CurrentActor() actor: Actor,
    @Param('id', ParseUUIDPipe) id: string,
    @Query({ schema: downloadQuery }) query: z.infer<typeof downloadQuery>,
    @Res({ passthrough: true }) res: Response,
  ) {
    return sendFile(res, await this.documents.open(actor, id), query.inline);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: optionalReasonBody }) body: OptionalReasonBody) {
    await this.documents.remove(actor, id, body?.reason ?? null);
  }

  @Roles(['PLATFORM_ADMIN'])
  @Post(':id/verify')
  @HttpCode(200)
  verify(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: verifyDocumentSchema }) body: VerifyDocumentInput) {
    return this.documents.verify(actor, id, body);
  }
}
