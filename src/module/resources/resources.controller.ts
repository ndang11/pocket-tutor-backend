import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResourcesService } from './resources.service';
import { supabaseAdmin } from '../../config/supabase';

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  /**
   * Extract and validate user from Authorization header
   */
  private async getUserId(authorization: string | undefined): Promise<string> {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authorization.replace('Bearer ', '');

    try {
      const {
        data: { user },
        error,
      } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      return user.id;
    } catch {
      throw new UnauthorizedException('Authentication failed');
    }
  }

  /**
   * Upload a document
   * POST /resources/upload
   */
  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
      },
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Headers('authorization') authorization: string,
  ) {
    const userId = await this.getUserId(authorization);

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const document = await this.resourcesService.uploadDocument(userId, file);

    return {
      success: true,
      message: 'Document uploaded successfully',
      data: document,
    };
  }

  /**
   * Get all documents for the authenticated user
   * GET /resources
   */
  @Get()
  async getDocuments(@Headers('authorization') authorization: string) {
    const userId = await this.getUserId(authorization);

    const result = await this.resourcesService.getUserDocuments(userId);

    return {
      success: true,
      data: result.documents,
      total: result.total,
    };
  }

  /**
   * Get a single document by ID
   * GET /resources/:id
   */
  @Get(':id')
  async getDocument(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = await this.getUserId(authorization);

    const document = await this.resourcesService.getDocument(userId, id);

    return {
      success: true,
      data: document,
    };
  }

  /**
   * Get download URL for a document
   * GET /resources/:id/download
   */
  @Get(':id/download')
  async getDownloadUrl(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = await this.getUserId(authorization);

    const url = await this.resourcesService.getDownloadUrl(userId, id);

    return {
      success: true,
      data: { url },
    };
  }

  /**
   * Delete a document by ID
   * DELETE /resources/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(
    @Param('id') id: string,
    @Headers('authorization') authorization: string,
  ) {
    const userId = await this.getUserId(authorization);

    await this.resourcesService.deleteDocument(userId, id);

    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }

  /**
   * Delete a document by file path (for storage-only files)
   * DELETE /resources/path/:path
   */
  @Delete('path/*')
  @HttpCode(HttpStatus.OK)
  async deleteDocumentByPath(
    @Param() params: { '0': string },
    @Headers('authorization') authorization: string,
  ) {
    const userId = await this.getUserId(authorization);
    const filePath = params['0'];

    await this.resourcesService.deleteDocumentByPath(userId, filePath);

    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }
}
