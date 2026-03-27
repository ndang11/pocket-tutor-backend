import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  Delete,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
    @Body('title') title: string,
  ) {
    this.logger.log('UPLOAD REQUEST START');

    this.logger.log(`Body: ${JSON.stringify({ userId, title })}`);
    this.logger.log(
      `File: ${JSON.stringify({
        originalname: file?.originalname,
        size: file?.size,
        mimetype: file?.mimetype,
        hasBuffer: !!file?.buffer,
        bufferSize: file?.buffer?.length,
      })}`,
    );

    if (!file) {
      this.logger.error('No file provided');
      throw new BadRequestException('No file uploaded');
    }

    if (!userId || !userId.trim()) {
      this.logger.error('No userId provided');
      throw new BadRequestException('userId is required');
    }

    if (!title || !title.trim()) {
      this.logger.error('No title provided');
      throw new BadRequestException('title is required');
    }

    if (!file.buffer || file.buffer.length === 0) {
      this.logger.error('File buffer is empty');
      throw new BadRequestException('File is empty');
    }

    try {
      const result = await this.documentsService.uploadAndRecord(
        file,
        userId,
        title,
      );
      this.logger.log('Upload successful');
      return { message: 'Document processed successfully', data: result };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new BadRequestException(error.message || 'Upload failed');
    }
  }

  @Get(':userId')
  async getUserDocuments(@Param('userId') userId: string) {
    this.logger.log(`Fetching documents for user: ${userId}`);
    return this.documentsService.getByUser(userId);
  }

  @Delete()
  async deleteDocument(@Body('path') path: string) {
    this.logger.log(`Deleting document at path: ${path}`);
    return this.documentsService.deleteByPath(path);
  }
}
