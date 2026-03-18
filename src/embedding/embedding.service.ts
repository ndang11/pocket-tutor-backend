import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey)
        throw new Error('Missing GEMINI_API_KEY in environment variables');
        this.genAI = new GoogleGenerativeAI(apiKey);
    } catch (err) {
        console.error(err.message)
    }
  }

  chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];

    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start += chunkSize - overlap;
    }

    return chunks;
  }

  async embedText(text: string): Promise<number[]> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-embedding-001',
    });
  
    const result = await model.embedContent(text);
    return result.embedding.values;
  }

  async chunkAndEmbed(text: string): Promise<{ chunk: string; embedding: number[] }[]> {
    const chunks = this.chunkText(text);
    this.logger.log(`Chunking text into ${chunks.length} chunks`);

    const results: { chunk: string; embedding: number[] }[] = [];

    for (const chunk of chunks) {
      const embedding = await this.embedText(chunk);
      results.push({ chunk, embedding });
    }

    this.logger.log(`Generated ${results.length} embeddings`);
    return results;
  }
}