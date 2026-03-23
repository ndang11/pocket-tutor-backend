import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';

@Module({
  controllers: [ChatController],
  providers: [ChatService, SupabaseService, EmbeddingService],
})
export class ChatModule {}
