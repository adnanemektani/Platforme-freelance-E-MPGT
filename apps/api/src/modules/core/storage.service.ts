import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

/**
 * Stockage privé des documents (compatible S3). Le bucket n'est jamais exposé :
 * les téléchargements passent par l'API, après contrôle d'autorisation.
 */
export interface ObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Readable>;
  healthy(): Promise<boolean>;
}

class MemoryStorage implements ObjectStorage {
  private readonly objects = new Map<string, Buffer>();
  async put(key: string, body: Buffer): Promise<void> {
    this.objects.set(key, Buffer.from(body));
  }
  async get(key: string): Promise<Readable> {
    const body = this.objects.get(key);
    if (!body) throw new Error('Objet introuvable');
    return Readable.from(body);
  }
  async healthy(): Promise<boolean> {
    return true;
  }
}

class S3Storage implements ObjectStorage {
  private readonly client: S3Client;
  private readonly bucket = env().S3_BUCKET;

  constructor() {
    this.client = new S3Client({
      endpoint: env().S3_ENDPOINT,
      region: env().S3_REGION,
      forcePathStyle: env().S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env().S3_ACCESS_KEY_ID!, secretAccessKey: env().S3_SECRET_ACCESS_KEY! },
    });
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ContentLength: body.length }),
    );
  }

  async get(key: string): Promise<Readable> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!result.Body) throw new Error('Objet introuvable');
    return result.Body as Readable;
  }

  async healthy(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}

@Injectable()
export class StorageService implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger('Storage');
  private readonly backend: ObjectStorage = env().STORAGE_DRIVER === 'memory' ? new MemoryStorage() : new S3Storage();

  async onModuleInit(): Promise<void> {
    if (this.backend instanceof S3Storage) {
      try {
        await this.backend.ensureBucket();
      } catch (error) {
        // Le démarrage n'est pas bloqué : le healthcheck signalera l'indisponibilité.
        this.logger.warn(`Stockage S3 indisponible au démarrage : ${(error as Error).message}`);
      }
    }
  }

  newKey(prefix = 'docs'): string {
    const now = new Date();
    return `${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`;
  }

  put(key: string, body: Buffer, contentType: string): Promise<void> {
    return this.backend.put(key, body, contentType);
  }

  get(key: string): Promise<Readable> {
    return this.backend.get(key);
  }

  healthy(): Promise<boolean> {
    return this.backend.healthy();
  }
}
