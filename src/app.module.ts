import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { DocumentsModule } from './documents/documents.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { ChatModule } from './chat/chat.module';
import { QuizModule } from './quiz/quiz.module';
import { FlashcardModule } from './flashcard/flashcard.module';
import { HistoryModule } from './history/history.module';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
    DocumentsModule,
    EmbeddingModule,
    ChatModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    QuizModule,
    FlashcardModule,
    HistoryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
