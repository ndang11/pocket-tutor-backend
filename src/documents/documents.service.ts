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
import PDFParser from 'pdf2json';
import * as pdfConvert from 'pdf-img-convert';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import Groq from 'groq-sdk';

@Injectable()
export class DocumentsService implements OnModuleInit {
  private readonly logger = new Logger(DocumentsService.name);
  private groq: Groq;

  private readonly supportedImageExtensions = new Set([
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'bmp',
    'heic',
    'heif',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {
    this.logger.log(
      `ENV CHECK: Key is ${process.env.GEMINI_API_KEY ? 'DEFINED' : 'UNDEFINED'}`,
    );
  }

  onModuleInit() {
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });
    this.logger.log('Groq client initialized');
  }

  private async resizeImage(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer).resize(1024).jpeg({ quality: 80 }).toBuffer();
  }

  private async extractImageText(file: Express.Multer.File): Promise<string> {
    this.logger.log(
      `Processing image: ${file.originalname} (Size: ${file.size} bytes)`,
    );

    const resizedBuffer = await this.resizeImage(file.buffer);

    return this.extractTextWithGeminiVision(
      resizedBuffer,
      'image/jpeg',
      `This is a photo of a student's hand-written notebook from a school in Cameroon.
        
        INSTRUCTIONS:
        1. Transcribe the handwriting exactly as written.
        2. If there are diagrams or drawings, describe them briefly in [brackets].
        3. Preserve the structure (headings, dates, bullet points).
        4. If a word is unreadable, use [unreadable] instead of guessing.
        5. Stay true to the notes, including local context.`,
    );
  }

  private async runGeminiVisionOnBase64(
    base64: string,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    const response = await this.groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
          ],
        },
      ],
      max_tokens: 4096,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  private async extractTextWithGeminiVision(
    buffer: Buffer,
    mimeType: string,
    prompt: string,
  ): Promise<string> {
    try {
      const base64 = buffer.toString('base64');
      const text = await this.runGeminiVisionOnBase64(base64, mimeType, prompt);
      this.logger.log(`Groq Vision extracted ${text.length} chars`);
      return this.normalizeExtractedText(text);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`GROQ VISION ERROR: ${error.message}`);
      return '';
    }
  }

  private async extractTextFromPdfImages(buffer: Buffer): Promise<string> {
    try {
      this.logger.log('Converting PDF pages to images for OCR...');

      const pgs = await pdfConvert.convert(buffer, {
        page_numbers: [1, 2, 3, 4, 5], // Limit to first 5 pages for performance
        width: 1200,
        base64: true,
      });

      this.logger.log(
        `Memory Usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
      );

      const pageImages = pgs as string[];

      // Process pages in parallel to save time
      const pagePromises = pageImages.map((img, i) =>
        this.runGeminiVisionOnBase64(
          img,
          'image/png',
          'Extract all text from this page. Preserve formatting and equations.',
        ).then((text) => `\n\n--- Page ${i + 1} ---\n\n${text}`),
      );

      const results = await Promise.all(pagePromises);
      return results.join('');
    } catch (err) {
      const error = err as Error;
      this.logger.error(`PDF-to-Image OCR failed: ${error.message}`);
      return '';
    }
  }

  private async extractPdfText(
    buffer: Buffer,
    originalName: string,
  ): Promise<string> {
    const attempts: Array<{ source: string; text: string }> = [];

    const pdfParseText = await this.tryPdfParse(buffer);
    if (pdfParseText) {
      attempts.push({ source: 'pdf-parse', text: pdfParseText });
    }

    const pdfReaderText = await this.parsePdfFallback(buffer);
    if (pdfReaderText) {
      attempts.push({ source: 'pdfreader', text: pdfReaderText });
    }

    const pdf2JsonText = await this.parsePdfWithPdf2Json(buffer);
    if (pdf2JsonText) {
      attempts.push({ source: 'pdf2json', text: pdf2JsonText });
    }

    const best = this.selectBestPdfExtraction(attempts);

    if (best && best.text.length >= 100) {
      this.logger.log(
        `PDF extraction selected ${best.source} for ${originalName} (${best.text.length} chars)`,
      );
      return best.text;
    }

    this.logger.log(
      `Standard extraction failed for ${originalName}, converting to images for OCR...`,
    );

    const ocrText = await this.extractTextFromPdfImages(buffer);

    if (ocrText && ocrText.length >= 50) {
      this.logger.log(
        `Image-based OCR extracted ${ocrText.length} chars from ${originalName}`,
      );
      return ocrText;
    }

    throw new BadRequestException(
      'I tried my best to read this document, but it appears to be image-based and my vision is currently at its limit. ' +
        'Please try uploading a text-based PDF, DOCX, or TXT file instead.',
    );
  }

  private async tryPdfParse(buffer: Buffer): Promise<string> {
    try {
      const originalWarn = console.warn;
      const originalLog = console.log;
      console.warn = () => {};
      console.log = () => {};
      try {
        const data = await pdfParse(buffer, { pagerender: false });
        return this.normalizeExtractedText(data.text || '');
      } finally {
        console.warn = originalWarn;
        console.log = originalLog;
      }
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`pdf-parse failed: ${error.message}`);
      return '';
    }
  }

  private async parsePdfFallback(buffer: Buffer): Promise<string> {
    return new Promise((resolve) => {
      const textParts: string[] = [];

      new PdfReader().parseBuffer(buffer, (err, item) => {
        if (err) {
          this.logger.warn(`pdfreader failed: ${String(err)}`);
          return resolve('');
        }

        if (!item) {
          return resolve(this.normalizeExtractedText(textParts.join(' ')));
        }

        if (item.text) textParts.push(item.text);
      });
    });
  }

  private async parsePdfWithPdf2Json(buffer: Buffer): Promise<string> {
    return new Promise((resolve) => {
      const parser = new PDFParser();

      parser.on(
        'pdfParser_dataError',
        (errData: Error | { parserError: Error }) => {
          const message =
            errData instanceof Error
              ? errData.message
              : errData?.parserError?.message || 'Unknown error';

          this.logger.warn(`pdf2json failed: ${message}`);
          resolve('');
        },
      );

      parser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          const pages = Array.isArray(pdfData?.Pages) ? pdfData.Pages : [];
          const text = pages
            .map((page: any) => {
              const texts = Array.isArray(page?.Texts) ? page.Texts : [];
              return texts
                .map((entry: any) =>
                  Array.isArray(entry?.R)
                    ? entry.R.map((part: any) =>
                        decodeURIComponent(part?.T || ''),
                      ).join('')
                    : '',
                )
                .filter(Boolean)
                .join(' ');
            })
            .join('\n\n');

          resolve(this.normalizeExtractedText(text));
        } catch (err) {
          const error = err as Error;
          this.logger.warn(`pdf2json processing failed: ${error.message}`);
          resolve('');
        }
      });

      parser.parseBuffer(buffer);
    });
  }

  private async extractEpubText(file: Express.Multer.File): Promise<string> {
    try {
      const JSZipModule = await import('jszip');
      const JSZip = JSZipModule.default;
      const xml2js = await import('xml2js');

      const zip = await JSZip.loadAsync(file.buffer);
      const containerEntry = zip.file('META-INF/container.xml');

      if (!containerEntry) {
        throw new Error('EPUB container.xml not found');
      }

      const containerXml = await containerEntry.async('text');
      const container = await xml2js.parseStringPromise(containerXml);
      const rootfilePath =
        container?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path'];

      if (!rootfilePath || typeof rootfilePath !== 'string') {
        throw new Error('EPUB package document path not found');
      }

      const packageEntry = zip.file(rootfilePath);
      if (!packageEntry) {
        throw new Error('EPUB package document missing');
      }

      const packageXml = await packageEntry.async('text');
      const packageDoc = await xml2js.parseStringPromise(packageXml);
      const packageDir = this.getDirectoryName(rootfilePath);

      const manifestItems =
        packageDoc?.package?.manifest?.[0]?.item?.map((item: any) => ({
          id: item?.$?.id as string | undefined,
          href: item?.$?.href as string | undefined,
          mediaType: item?.$?.['media-type'] as string | undefined,
        })) || [];

      const manifestById = new Map(
        manifestItems
          .filter((item: { id?: string }) => !!item.id)
          .map((item: { id?: string; href?: string; mediaType?: string }) => [
            item.id as string,
            item,
          ]),
      );

      const spineRefs =
        packageDoc?.package?.spine?.[0]?.itemref?.map(
          (itemref: any) => itemref?.$?.idref as string | undefined,
        ) || [];

      const chapterPaths = spineRefs
        .map((idref: string | undefined) =>
          idref ? manifestById.get(idref) : undefined,
        )
        .filter(
          (item: { href?: string; mediaType?: string } | undefined) =>
            !!item?.href &&
            [
              'application/xhtml+xml',
              'text/html',
              'application/xml',
              'text/xml',
            ].includes(item.mediaType || ''),
        )
        .map((item: { href?: string }) =>
          this.resolveZipPath(packageDir, item.href as string),
        );

      const chapterTexts: string[] = [];

      for (const chapterPath of chapterPaths) {
        const chapterEntry = zip.file(chapterPath);
        if (!chapterEntry) continue;

        const chapterContent = await chapterEntry.async('text');
        const cleaned = this.extractTextFromMarkup(chapterContent);
        if (cleaned) chapterTexts.push(cleaned);
      }

      if (!chapterTexts.length) {
        const fallbackTexts: string[] = [];

        for (const fileName of Object.keys(zip.files)) {
          if (!/\.(xhtml|html|htm)$/i.test(fileName)) continue;

          const entry = zip.file(fileName);
          if (!entry) continue;

          const content = await entry.async('text');
          const cleaned = this.extractTextFromMarkup(content);
          if (cleaned) fallbackTexts.push(cleaned);
        }

        return this.normalizeExtractedText(fallbackTexts.join('\n\n'));
      }

      return this.normalizeExtractedText(chapterTexts.join('\n\n'));
    } catch (err) {
      const error = err as Error;
      this.logger.error(`EPUB parse failed: ${error.message}`);
      return '';
    }
  }

  private async extractText(file: Express.Multer.File): Promise<string> {
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      return this.extractPdfText(file.buffer, file.originalname);
    }

    if (ext === 'docx') {
      try {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return this.normalizeExtractedText(result.value || '');
      } catch (err) {
        const error = err as Error;
        this.logger.error(`DOCX parse failed: ${error.message}`);
        return '';
      }
    }

    if (ext === 'txt') {
      return this.normalizeExtractedText(file.buffer.toString('utf-8'));
    }

    if (ext === 'epub') {
      return this.extractEpubText(file);
    }

    if (ext && this.supportedImageExtensions.has(ext)) {
      return this.extractImageText(file);
    }

    throw new BadRequestException(
      'Unsupported file type. Upload PDF, DOCX, TXT, EPUB, or an image file such as JPG, PNG, WEBP, HEIC.',
    );
  }

  private extractTextFromMarkup(markup: string): string {
    return this.normalizeExtractedText(
      markup
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|h5|h6|tr)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n• ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'"),
    );
  }

  private getDirectoryName(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    return lastSlashIndex === -1
      ? ''
      : normalizedPath.slice(0, lastSlashIndex + 1);
  }

  private resolveZipPath(baseDir: string, relativePath: string): string {
    const segments = `${baseDir}${relativePath}`.split('/');
    const resolved: string[] = [];

    for (const segment of segments) {
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        resolved.pop();
        continue;
      }
      resolved.push(segment);
    }

    return resolved.join('/');
  }

  private getImageMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      case 'heic':
        return 'image/heic';
      case 'heif':
        return 'image/heif';
      default:
        return 'image/jpeg';
    }
  }

  private selectBestPdfExtraction(
    attempts: Array<{ source: string; text: string }>,
  ): { source: string; text: string } | null {
    if (!attempts.length) return null;

    return attempts.sort(
      (a, b) =>
        this.scoreExtractedText(b.text) - this.scoreExtractedText(a.text),
    )[0];
  }

  private scoreExtractedText(text: string): number {
    const normalized = this.normalizeExtractedText(text);
    const words = normalized.split(/\s+/).filter(Boolean);
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const alphanumericChars = (normalized.match(/[A-Za-z0-9]/g) || []).length;

    return normalized.length + uniqueWords.size * 2 + alphanumericChars;
  }

  private normalizeExtractedText(text: string): string {
    return text
      .split('\0')
      .join(' ')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
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

    const doc = await this.prisma.documentation.findFirst({ where: { path } });

    if (!doc) throw new BadRequestException('Document not found');

    await client.from('document_chunks').delete().eq('document_id', doc.id);
    await this.prisma.documentation.delete({ where: { id: doc.id } });

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
      profile = await this.prisma.profile.create({ data: { id: userId } });
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

    if (extractedText.trim().length < 20) {
      this.logger.warn(
        `Extracted very little text (${extractedText.length} chars) from ${file.originalname}`,
      );
    }

    if (!extractedText || extractedText.trim().length < 50) {
      throw new BadRequestException(
        'The AI could not read any text from this file. Please ensure the file is clear and readable.',
      );
    }

    const document = await this.prisma.documentation.create({
      data: { title, path: data.path, userId },
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

      if (error) throw new Error(error.message);

      this.logger.log(`Processed ${payload.length} chunks for doc ${docId}`);
    } catch (err) {
      this.logger.error(`Embedding processing failed for ${docId}`, err);
    }
  }
}
