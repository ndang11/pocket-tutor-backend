import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async ask(documentId: string, userId: string, question: string) {
    if (!documentId?.trim() || !userId?.trim() || !question?.trim()) {
      throw new BadRequestException(
        'documentId, userId and question are required',
      );
    }

    this.logger.log(`Embedding question: "${question}"`);
    const questionEmbedding = await this.embedding.embedText(question);

    const { data: chunks, error } = await this.supabase
      .getClient()
      .rpc('match_document_chunks', {
        query_embedding: questionEmbedding,
        match_document_id: documentId,
        match_user_id: userId,
        match_count: 5,
      });

    if (error) {
      this.logger.error('Vector search failed', error.message);
      throw new BadRequestException(`Vector search failed: ${error.message}`);
    }

    if (!chunks || chunks.length === 0) {
      throw new BadRequestException(
        'No relevant content found in this document for your question.',
      );
    }

    this.logger.log(`Retrieved ${chunks.length} relevant chunks`);

    const context = chunks
      .map((c: any, i: number) => `[Section ${i + 1}]:\n${c.content}`)
      .join('\n\n');

    const prompt = `You are Pocket Tutor, a strict pedagogical AI assistant.
    You must only answer using the document context provided below.
    If the question cannot be answered from the context, respond with:
    "I can only help with what is in your uploaded document."

    DOCUMENT CONTEXT:
    ${context}

    STUDENT QUESTION:
    ${question}

    Provide a clear, educational answer based only on the context above.`;
try {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    const result = await model.generateContent(prompt);
    const answer = result.response.text();

    this.logger.log('Answer generated successfully');

    return {
      question,
      answer,
      sourcesUsed: chunks.length,
      sources: chunks.map((c: any) => ({
        chunkIndex: c.chunk_index,
        preview: c.content.slice(0, 100),
      })),
    };
} catch (err) {
    if (err?.status === 429) {
        throw new BadRequestException(
          'Gemini API quota exceeded. Please try again tomorrow or add billing at aistudio.google.com',
        );
      }
      throw new BadRequestException(`Gemini error: ${err.message}`);
}
  }
}
