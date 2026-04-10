import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prismaClient = new PrismaClient(adapter);

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await prismaClient.$connect();
    } catch (e) {
      console.error('Failed to connect to database:', e);
    }
  }

  async onModuleDestroy() {
    await prismaClient.$disconnect();
    pool.end();
  }

  get profile() {
    return prismaClient.profile;
  }

  get documentation() {
    return prismaClient.documentation;
  }

  get document_chunks() {
    return prismaClient.document_chunks;
  }

  get flashcard() {
    return prismaClient.flashcard;
  }

  get $connect() {
    return prismaClient.$connect;
  }

  get $disconnect() {
    return prismaClient.$disconnect;
  }

  get $transaction() {
    return prismaClient.$transaction;
  }
}
