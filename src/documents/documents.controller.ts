import { Controller, Post, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service'; 

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
  })) 
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
    @Body('title') title: string,
  ) {
    console.log('FILE:', file?.originalname);
    console.log('USERID:', userId);
    console.log('TITLE:', title);
    
    const result = await this.documentsService.uploadAndRecord(file, userId, title);
    
    return {
      message: 'Document processed successfully',
      data: result,
    };
  }
}