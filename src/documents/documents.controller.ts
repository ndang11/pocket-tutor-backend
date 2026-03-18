// src/documents/documents.controller.ts
import { Controller, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseService } from '../superbase/superbase.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file')) // 'file' is the key in FormData
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    // 1. Upload to Supabase Storage
    const storageData = await this.supabaseService.uploadFile(file, 'pamphlets');
    
    // 2. Return the path to the frontend
    return {
      message: 'Upload successful',
      path: storageData.path,
    };
  }
}