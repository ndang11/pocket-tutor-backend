import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
<<<<<<< HEAD
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });

    this.client = new PrismaClient({ adapter });
=======
    super({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
>>>>>>> a060cab (fix: made new changes on the chat controller)
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
<<<<<<< HEAD

  get profile() {
    return this.client.profile;
  }
=======
>>>>>>> a060cab (fix: made new changes on the chat controller)
}
