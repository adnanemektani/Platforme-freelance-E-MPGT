import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createImportSchema,
  importItemListQuery,
  pageQuery,
  reviewImportItemSchema,
  type CreateImportInput,
  type ImportItemListQuery,
  type PageQuery,
  type ReviewImportItemInput,
} from '@empgt/contracts';
import { z } from 'zod';
import { badRequest } from '../../common/errors.js';
import type { Actor } from '../auth/actor.js';
import { CurrentActor, Roles } from '../auth/decorators.js';
import { uploadInterceptor } from '../documents/document.controller.js';
import type { UploadedFile as Upload } from '../documents/document.service.js';
import { ImportService } from './import.service.js';

const uploadSnapshotSchema = z.object({ sourceUrl: z.url().max(500), collectedAt: z.iso.datetime({ offset: true }).optional() });

@ApiTags('Administration — import des profils historiques')
@Roles(['PLATFORM_ADMIN'])
@Controller('admin')
export class ImportController {
  constructor(private readonly imports: ImportService) {}

  @Get('imports')
  list(@Query({ schema: pageQuery }) query: PageQuery) {
    return this.imports.listBatches(query);
  }

  @Post('imports')
  @ApiOperation({ summary: 'Collecter la page source (hôte autorisé) et créer un lot en prévisualisation' })
  async create(@CurrentActor() actor: Actor, @Body({ schema: createImportSchema }) body: CreateImportInput) {
    const html = await this.imports.fetchSnapshot(body.sourceUrl);
    return this.imports.createBatch(actor, html, body.sourceUrl);
  }

  @Post('imports/upload')
  @UseInterceptors(uploadInterceptor())
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Créer un lot à partir d’un instantané HTML enregistré (reproductibilité)' })
  upload(@CurrentActor() actor: Actor, @UploadedFile() file: Upload | undefined, @Body({ schema: uploadSnapshotSchema }) body: z.infer<typeof uploadSnapshotSchema>) {
    if (!file?.buffer?.length) throw badRequest('Aucun fichier reçu.');
    const html = file.buffer.toString('utf8');
    if (!html.includes('__NEXT_DATA__')) throw badRequest('Ce fichier n’est pas un instantané de la page des profils.');
    return this.imports.createBatch(actor, html, body.sourceUrl, body.collectedAt ? new Date(body.collectedAt) : new Date());
  }

  @Get('imports/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.imports.getBatch(id);
  }

  @Get('imports/:id/items')
  items(@Param('id', ParseUUIDPipe) id: string, @Query({ schema: importItemListQuery }) query: ImportItemListQuery) {
    return this.imports.listItems(id, query);
  }

  @Get('import-items/:id')
  item(@Param('id', ParseUUIDPipe) id: string) {
    return this.imports.getItem(id);
  }

  @Post('import-items/:id/review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valider (créer / mettre à jour le profil privé), ignorer ou marquer comme doublon' })
  review(@CurrentActor() actor: Actor, @Param('id', ParseUUIDPipe) id: string, @Body({ schema: reviewImportItemSchema }) body: ReviewImportItemInput) {
    return this.imports.review(actor, id, body);
  }
}
