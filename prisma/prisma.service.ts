// import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';
// import { ConfigService } from '@nestjs/config';

// @Injectable()
// export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
//   constructor(private configService: ConfigService) {
//     super();
//   }

//   async onModuleInit() {
//     const databaseUrl = this.configService.get('DATABASE_URL');
//     if (databaseUrl) {
//       await this.$connect();
//     }
//   }

//   async onModuleDestroy() {
//     await this.$disconnect();
//   }
// }

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    // 1. Get the URL from ConfigService
    const connectionString = configService.get<string>('DATABASE_URL');

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined in the configuration');
    }

    // 2. Create the PG connection pool
    const pool = new Pool({ connectionString });

    // 3. Initialize the Driver Adapter
    const adapter = new PrismaPg(pool);

    // 4. Pass the adapter to the parent PrismaClient constructor
    super({ adapter });
  }

  async onModuleInit() {
    // Verifies the connection to Supabase/PostgreSQL is alive
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
