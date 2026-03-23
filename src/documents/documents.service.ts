import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';
import * as mammoth from 'mammoth';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private pdfParse: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {}

  async onModuleInit() {
    // Dynamically import pdf-parse when the module initializes
    this.pdfParse = (await import('pdf-parse')).default;
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      try {
        if (!this.pdfParse) {
          this.pdfParse = (await import('pdf-parse')).default;
        }
        const data = await this.pdfParse(file.buffer);
        return data.text || '';
      } catch (error) {
        this.logger.error(`Failed to parse PDF: ${error.message}`);
        return '';
      }
    }

    if (ext === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return result.value || '';
      } catch (err) {
        this.logger.error(`Failed to parse DOCX: ${err.message}`);
        return '';
      }
    }

    if (ext === 'txt') {
      return file.buffer.toString('utf-8');
    }

    throw new BadRequestException(
      'Unsupported file type. Please upload a PDF, DOCX, or TXT file.',
    );
  }


  async getByUser(userId: string) {
    return this.prisma.documentation.findMany({
      where: { userId },
      orderBy: { created_at: 'desc' },  
    });
  }

  async deleteByPath(path: string) {
    const { error } = await this.supabase
      .getClient()
      .storage.from('documents')
      .remove([path]);
  
    if (error)
      throw new BadRequestException(`Storage delete failed: ${error.message}`);
 
    const doc = await this.prisma.documentation.findFirst({
      where: { path },
    });
  
    if (!doc) throw new BadRequestException('Document not found');
  
    await this.prisma.documentation.delete({
      where: { id: doc.id },
    });
  
    return { message: 'Document deleted successfully' };
  }

  async uploadAndRecord(
    file: Express.Multer.File,
    userId: string,
    title: string,
  ) {
    if (!file?.originalname) throw new BadRequestException('Invalid file');
    if (!userId?.trim() || !title?.trim())
      throw new BadRequestException('userId and title are required');

    const fileExt = file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExt || fileExt === file.originalname)
      throw new BadRequestException('Could not determine file extension');

    const storagePath = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await this.supabase
      .getClient()
      .storage.from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) throw new BadRequestException(`Storage Error: ${error.message}`);

    const extractedText = await this.extractText(file);
    this.logger.log(
      `Extracted ${extractedText.length} characters from ${file.originalname}`,
    );

    const document = await this.prisma.documentation.create({
      data: { title, path: data.path, userId },
    });

    if (extractedText.trim().length > 0) {
      const chunks = await this.embedding.chunkAndEmbed(extractedText);

      for (let i = 0; i < chunks.length; i++) {
        const { chunk, embedding } = chunks[i];

        const { error: chunkError } = await this.supabase
          .getClient()
          .from('document_chunks')
          .insert({
            document_id: document.id,
            user_id: userId,
            chunk_index: i,
            content: chunk,
            embedding: JSON.stringify(embedding),
          });

        if (chunkError) {
          this.logger.error(`Failed to store chunk ${i}: ${chunkError.message}`);
        }
      }

      this.logger.log(
        `Stored ${chunks.length} chunks with embeddings for document ${document.id}`,
      );
    }

    return {
      ...document,
      extractedTextLength: extractedText.length,
      preview: extractedText.slice(0, 200),
    };
  }
}