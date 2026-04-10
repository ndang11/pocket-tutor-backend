import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const prismaClient = new PrismaClient();

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
