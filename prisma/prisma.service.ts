import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import 'dotenv/config';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public pool: Pool;
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
      await this.ensureStudyHistoryTable();
    } catch (e) {
      console.error('Failed to connect to database:', e);
    }
  }

  private async ensureStudyHistoryTable() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS study_history (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" TEXT NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          duration INT,
          score INT,
          "totalQuestions" INT,
          "correctAnswers" INT,
          "documentId" TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (e) {
      console.error('Failed to create study_history table:', e);
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

  get educationLevel() {
    return this.prismaClient.educationLevel;
  }

  get stream() {
    return this.prismaClient.stream;
  }

  get subject() {
    return this.prismaClient.subject;
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