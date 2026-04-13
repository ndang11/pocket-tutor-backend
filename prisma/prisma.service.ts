import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import 'dotenv/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private prismaClient: PrismaClient;

  async onModuleInit() {
    try {
      this.pool = new Pool({ 
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      const adapter = new PrismaPg(this.pool);
      this.prismaClient = new PrismaClient({ adapter });
      await this.prismaClient.$connect();
    } catch (e) {
      console.error('Failed to connect to database:', e);
    }
  }

  async onModuleDestroy() {
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
    }
    if (this.pool) {
      this.pool.end();
    }
  }

  get profile() {
    return this.prismaClient.profile;
  }

  get documentation() {
    return this.prismaClient.documentation;
  }

  get document_chunks() {
    return this.prismaClient.document_chunks;
  }

  get flashcard() {
    return this.prismaClient.flashcard;
  }

  get $connect() {
    return this.prismaClient.$connect;
  }

  get $disconnect() {
    return this.prismaClient.$disconnect;
  }

  get $transaction() {
    return this.prismaClient.$transaction;
  }
}