import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, SupabaseService],
})
export class DocumentsModule {}