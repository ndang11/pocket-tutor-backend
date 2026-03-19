import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit {
  private client: PrismaClient;

  constructor() {
    const adapter = new PrismaPg({ 
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      }
    });
    
    this.client = new PrismaClient({ adapter });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  get documentation() {
    return this.client.documentation;
  }

  get profile() {
    return this.client.profile;
  }
}