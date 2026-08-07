import { Injectable } from '@nestjs/common';
import * as argon2 from '@node-rs/argon2';

/**
 * Argon2id password hashing (BRD NFR — Argon2id, memory ≥ 64 MB, iterations ≥ 3).
 *
 * All password hashing in the system goes through this single service so the
 * parameters are centralized and auditable.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = {
    memoryCost: 64 * 1024, // 64 MB
    timeCost: 3, // iterations ≥ 3
    parallelism: 2,
    outputLen: 32,
  };

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }
}
