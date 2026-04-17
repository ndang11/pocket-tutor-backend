import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatSessionController } from './chat-session.controller';
import { ChatService } from './chat.service';
import { ChatSessionService } from './chat-session.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';

@Module({
  controllers: [ChatController, ChatSessionController],
  providers: [ChatService, ChatSessionService, SupabaseService, EmbeddingService],
})
export class ChatModule {}
