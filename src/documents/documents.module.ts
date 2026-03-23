import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingModule } from 'src/embedding/embedding.module';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, SupabaseService, EmbeddingModule],
})
export class DocumentsModule {}
