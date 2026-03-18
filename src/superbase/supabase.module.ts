import { Module, Global } from '@nestjs/common';
import { SupabaseService } from '../superbase/superbase.service';

@Global() 
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}