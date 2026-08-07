import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma';

/**
 * Prisma client with the DataScopeInterceptor hooked into $use middleware.
 * The scope guard is the LAST line of defense (BRD 5.3): developers who
 * forget to filter still cannot leak cross-branch data.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}