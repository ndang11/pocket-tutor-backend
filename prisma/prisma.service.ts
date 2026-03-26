import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // 1. Create the connection pool
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // 2. Setup the adapter
    const adapter = new PrismaPg(pool);

    // 3. Pass the adapter to the parent PrismaClient constructor
    // We cast to 'any' because Prisma 7 types can be strict with adapters
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Ensure your getters are still here so ChatService doesn't break
  get documentation() {
    return this.documentation;
  }

  get profile() {
    return this.profile;
  }
}
