import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly groq: OpenAI;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error('Missing GEMINI_API_KEY');
    this.genAI = new GoogleGenerativeAI(geminiKey);

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Missing GROQ_API_KEY');
    this.groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  private buildPrompt(context: string, question: string): string {
    return `You are Pocket Tutor, a strict pedagogical AI assistant.
You must only answer using the document context provided below.
If the question cannot be answered from the context, respond with:
"I can only help with what is in your uploaded document."

DOCUMENT CONTEXT:
${context}

STUDENT QUESTION:
${question}

Provide a clear, educational answer based only on the context above.`;
  }

  private async askGemini(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }

  private async askGroq(prompt: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
    });
    return completion.choices[0].message.content ?? '';
  }

  async ask(documentId: string, userId: string, question: string) {
    // Add logging at the very beginning
    this.logger.log(`=== CHAT REQUEST START ===`);
    this.logger.log(`documentId: "${documentId}"`);
    this.logger.log(`userId: "${userId}"`);
    this.logger.log(`question: "${question}"`);
    this.logger.log(`documentId length: ${documentId?.length}`);
    this.logger.log(`userId length: ${userId?.length}`);
    this.logger.log(`question length: ${question?.length}`);

    if (!documentId?.trim() || !userId?.trim() || !question?.trim()) {
      this.logger.error(`Validation failed:`);
      this.logger.error(`- documentId exists: ${!!documentId}`);
      this.logger.error(`- documentId trimmed: "${documentId?.trim()}"`);
      this.logger.error(`- userId exists: ${!!userId}`);
      this.logger.error(`- userId trimmed: "${userId?.trim()}"`);
      this.logger.error(`- question exists: ${!!question}`);
      this.logger.error(`- question trimmed: "${question?.trim()}"`);
      throw new BadRequestException(
        'documentId, userId and question are required',
      );
    }

    // Log that validation passed
    this.logger.log(`✅ Validation passed`);

    this.logger.log(`Embedding question: "${question}"`);
    const questionEmbedding = await this.embedding.embedText(question);

    this.logger.log(`Searching for chunks with:`);
    this.logger.log(`- documentId: ${documentId}`);
    this.logger.log(`- userId: ${userId}`);

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

    this.logger.log(`Found ${chunks?.length || 0} chunks`);

    if (!chunks || chunks.length === 0) {
      this.logger.error(
        `No chunks found for document ${documentId} and user ${userId}`,
      );
      throw new BadRequestException(
        'No relevant content found in this document for your question.',
      );
    }

    this.logger.log(`Retrieved ${chunks.length} relevant chunks`);

    const context = chunks
      .map((c: any, i: number) => `[Section ${i + 1}]:\n${c.content}`)
      .join('\n\n');

    const prompt = this.buildPrompt(context, question);

    let answer: string;
    let modelUsed: string;

    // ── Groq is primary. If it fails, Gemini is the fallback. ────────
    try {
      answer = await this.askGroq(prompt);
      modelUsed = 'llama-3.3-70b-versatile (groq)';
      this.logger.log(
        `Model used: ${modelUsed} | Document: ${documentId} | Chunks: ${chunks.length}`,
      );
    } catch (groqErr) {
      this.logger.warn(
        `Groq failed — ${groqErr?.message}, falling back to Gemini...`,
      );

      try {
        answer = await this.askGemini(prompt);
        modelUsed = 'gemini-2.0-flash-lite';
        this.logger.log(
          `Model used: ${modelUsed} | Document: ${documentId} | Chunks: ${chunks.length}`,
        );
      } catch (geminiErr) {
        this.logger.error('Both Groq and Gemini failed', geminiErr.message);
        throw new BadRequestException(
          'AI service temporarily unavailable. Please try again in a moment.',
        );
      }
    }

    return {
      question,
      answer,
      modelUsed,
      sourcesUsed: chunks.length,
      sources: chunks.map((c: any) => ({
        chunkIndex: c.chunk_index,
        preview: c.content.slice(0, 100),
      })),
    };
  }

  async getSummary(content: string): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'user', content: `Summarize these notes:\n\n${content}` },
      ],
    });
    return completion.choices[0].message.content ?? '';
  }
}
