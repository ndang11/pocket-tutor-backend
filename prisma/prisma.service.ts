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
        ssl: { rejectUnauthorized: false },
      });
      const adapter = new PrismaPg(this.pool);
      this.prismaClient = new PrismaClient({ adapter });
      await this.prismaClient.$connect();
      await this.ensureStudyHistoryTable();
      await this.ensureChatSessionTables();
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

  private async ensureChatSessionTables() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" TEXT NOT NULL,
          title TEXT NOT NULL,
          subject TEXT,
          "educationLevel" TEXT,
          stream TEXT,
          "lastMessage" TEXT,
          "messageCount" INT DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "sessionId" TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);
    } catch (e) {
      console.error('Failed to create chat session tables:', e);
    }
  }

  async onModuleDestroy() {
    if (this.prismaClient) {
      await this.prismaClient.$disconnect();
    }
    if (this.pool) {
      await this.pool.end();
    }
  }

  get profile() {
    return this.prismaClient.profile;
  }

  get topicMastery() {
    return this.prismaClient.topicMastery;
  }

  get learningProfile() {
    return this.prismaClient.learningProfile;
  }

  get documentation() {
    return this.prismaClient.documentation;
  }

  get chatSession() {
    return this.prismaClient.chatSession;
  }

  get chatMessage() {
    return this.prismaClient.chatMessage;
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
    return this.prismaClient.$connect.bind(this.prismaClient);
  }

  get $disconnect() {
    return this.prismaClient.$disconnect.bind(this.prismaClient);
  }

  get $transaction() {
    return this.prismaClient.$transaction.bind(this.prismaClient);
  }
}
