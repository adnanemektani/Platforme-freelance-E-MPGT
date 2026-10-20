import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

/** Client ou transaction : les services acceptent les deux pour composer des opérations atomiques. */
export type Db = PrismaClient | Prisma.TransactionClient;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger('Prisma');

  constructor() {
    super({
      adapter: new PrismaPg({ connectionString: env().DATABASE_URL }),
      log: [{ emit: 'event', level: 'warn' }],
      // Valeurs par défaut de Prisma (2 s / 5 s) trop courtes sur un serveur chargé : une transaction
      // refusée faute de connexion libre échouerait sans raison métier.
      transactionOptions: { maxWait: 10_000, timeout: 15_000 },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Transaction en isolation « Serializable » pour les opérations concurrentes sensibles
   * (sélection d'un candidat, enregistrement d'un paiement…). Rejoue automatiquement
   * en cas de conflit de sérialisation.
   */
  async serializable<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.$transaction(fn, { isolationLevel: 'Serializable', timeout: 15_000 });
      } catch (error) {
        const code = (error as { code?: string }).code;
        const retryable = code === 'P2034' || /could not serialize|deadlock/i.test(String((error as Error)?.message));
        if (!retryable || attempt >= attempts) throw error;
        this.logger.warn(`Conflit de sérialisation, nouvelle tentative (${attempt}/${attempts})`);
      }
    }
  }
}
