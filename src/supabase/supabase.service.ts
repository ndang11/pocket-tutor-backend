import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private clientInstance: SupabaseClient;

  get storage() {
    return this.clientInstance.storage;
  }

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables',
      );
    }

    this.clientInstance = createClient(url, key);
    this.logger.log('Supabase Connection Initialized');
  }

  async onModuleInit() {
    try {
      const { data, error } = await this.clientInstance
        .from('profiles')
        .select('id')
        .limit(1);

      if (error) throw error;

      this.logger.log(' Supabase Bridge: Live Connection Successful!');
    } catch (err) {
      this.logger.error(' Supabase Bridge: Connection Failed!', err.message);
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string) {
    const fileName = `${folder}/${Date.now()}-${file.originalname}`;

    const { data, error } = await this.clientInstance.storage
      .from('documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) throw error;
    return data;
  }

  getClient() {
    return this.clientInstance;
  }
}
