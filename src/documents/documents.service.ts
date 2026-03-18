import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';
import * as mammoth from 'mammoth';
const pdfParse = require('pdf-parse');

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {}

  private async extractText(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      try {
        const result = await pdfParse(file.buffer);
        return result.text || '';
      } catch (err) {
        this.logger.error(`Failed to parse PDF: ${err.message}`);
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

    // ── Step 1: Upload to Supabase Storage ──────────────────────────────
    const storagePath = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await this.supabase
      .getClient()
      .storage.from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) throw new BadRequestException(`Storage Error: ${error.message}`);

    // ── Step 2: Extract text ─────────────────────────────────────────────
    const extractedText = await this.extractText(file);
    this.logger.log(
      `Extracted ${extractedText.length} characters from ${file.originalname}`,
    );

    // ── Step 3: Save document record to database ─────────────────────────
    const document = await this.prisma.documentation.create({
      data: { title, path: data.path, userId },
    });

    // ── Step 4: Chunk + Embed + Store vectors ────────────────────────────
    if (extractedText.trim().length > 0) {
      const chunks = await this.embedding.chunkAndEmbed(extractedText);

      for (let i = 0; i < chunks.length; i++) {
        const { chunk, embedding } = chunks[i];

        // Store each chunk with its vector using raw SQL via Supabase
        // We use Supabase client here because Prisma does not support vector type
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