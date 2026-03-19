import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsModule } from './documents/documents.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    PrismaModule,
    DocumentsModule,
    EmbeddingModule,
    ChatModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController],
  providers: [AppService, SupabaseService],
})
export class AppModule {}
