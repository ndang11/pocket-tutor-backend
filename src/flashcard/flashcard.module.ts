import { Module } from '@nestjs/common';
// Change these to have the 's'
import { FlashcardService } from './flashcard.service';
import { FlashcardController } from './flashcard.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  // Update these too
  controllers: [FlashcardController],
  providers: [FlashcardService],
  exports: [FlashcardService],
})
export class FlashcardModule {}
