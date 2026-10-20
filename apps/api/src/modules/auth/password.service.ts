import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';

// Argon2id, paramètres conformes aux recommandations OWASP (≥ 19 Mio, 2 itérations).
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordService {
  private dummyHash: Promise<string> | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    if (!hash) {
      // Temps de réponse homogène même sans compte : limite l'énumération des adresses.
      this.dummyHash ??= argon2.hash('empgt-dummy-password-for-timing', OPTIONS);
      await argon2.verify(await this.dummyHash, password).catch(() => false);
      return false;
    }
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }
}
