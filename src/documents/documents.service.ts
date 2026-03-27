import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';
import * as mammoth from 'mammoth';
import { PdfReader } from 'pdfreader';

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentsService.name);
  private pdfParse: any;

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {}

  async onModuleInit() {
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
      } catch {
        return this.parsePdfFallback(file.buffer);
      }
    }

    if (ext === 'docx') {
      try {
        const result = await mammoth.extractRawText({
          buffer: file.buffer,
        });
        return result.value || '';
      } catch (err) {
        const error = err as Error;
        this.logger.error(`DOCX parse failed: ${error.message}`);
        return '';
      }
    }

    if (ext === 'txt') {
      return file.buffer.toString('utf-8');
    }

    throw new BadRequestException(
      'Unsupported file type. Upload PDF, DOCX, or TXT.',
    );
  }

  private async parsePdfFallback(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const textParts: string[] = [];

      new PdfReader().parseBuffer(buffer, (err, item) => {
        if (err) return reject(new Error(String(err)));

        if (!item) return resolve(textParts.join(' '));

        if (item.text) textParts.push(item.text);
      });
    });
  }

  async getByUser(userId: string) {
    return await this.prisma.documentation.findMany({
      where: { userId },
      orderBy: { created_at: 'desc' },
    });
  }

  async deleteByPath(path: string) {
    const client = this.supabase.getClient();

    const { error } = await client.storage.from('documents').remove([path]);

    if (error) {
      throw new BadRequestException(`Storage delete failed: ${error.message}`);
    }

    const doc = await this.prisma.documentation.findFirst({
      where: { path },
    });

    if (!doc) throw new BadRequestException('Document not found');

    await client.from('document_chunks').delete().eq('document_id', doc.id);

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
      throw new BadRequestException('userId and title required');

    const fileExt = file.originalname.split('.').pop()?.toLowerCase();

    if (!fileExt || fileExt === file.originalname) {
      throw new BadRequestException('Invalid file extension');
    }

    let profile = await this.prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      profile = await this.prisma.profile.create({
        data: { id: userId },
      });
      this.logger.log(`Created profile for user ${userId}`);
    }

    const storagePath = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await this.supabase
      .getClient()
      .storage.from('documents')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new BadRequestException(`Storage Error: ${error.message}`);
    }

    const extractedText = await this.extractText(file);

    this.logger.log(
      `Extracted ${extractedText.length} chars from ${file.originalname}`,
    );

    if (extractedText.trim().length < 100) {
      await this.supabase
        .getClient()
        .storage.from('documents')
        .remove([storagePath]);

      throw new BadRequestException(
        'File appears to be scanned or empty. Upload a text-based file.',
      );
    }

    const document = await this.prisma.documentation.create({
      data: {
        title,
        path: data.path,
        userId,
      },
    });

    this.processEmbeddingsInBackground(
      document.id,
      userId,
      extractedText,
    ).catch((err) => this.logger.error('Background processing failed', err));

    return {
      ...document,
      extractedTextLength: extractedText.length,
      preview: extractedText.slice(0, 200),
      message: 'Processing started',
    };
  }

  private async processEmbeddingsInBackground(
    docId: string,
    userId: string,
    text: string,
  ) {
    const client = this.supabase.getClient();

    try {
      const chunks = await this.embedding.chunkAndEmbed(text);

      const payload = chunks.map((c, i) => ({
        document_id: docId,
        user_id: userId,
        chunk_index: i,
        content: c.chunk,
        embedding: JSON.stringify(c.embedding),
      }));

      const { error } = await client.from('document_chunks').insert(payload);

      if (error) {
        throw new Error(error.message);
      }

      this.logger.log(`Processed ${payload.length} chunks for doc ${docId}`);
    } catch (err) {
      this.logger.error(`Embedding processing failed for ${docId}`, err);
    }
  }
}
