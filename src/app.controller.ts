import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SupabaseService } from './supabase/supabase.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Get('check-db')
  async connection() {
    try {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.from('profiles').select('count');
      if (error) return { status: 'Error', message: error.message };
      return { status: 'Online', message: 'NestJS is talking to Supabase!' };
    } catch (error) {
      console.error(
        'failed to get the connection between the supabase and the backend',
      );
      return { status: 'Error', message: 'Unexpected error occurred' };
    }
  }
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
