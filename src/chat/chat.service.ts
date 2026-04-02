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
  // debug
  private buildPrompt(
    context: string,
    question: string,
    profile?: any,
  ): string {
    const profileContext = profile
      ? `
  STUDENT PROFILE:
  - Name: ${profile.full_name || 'Unknown'}
  - Academic Level: ${profile.academic_system || 'Unknown'}
  - Field of Study: ${profile.topic || 'Unknown'}
  - Study Hours per Day: ${profile.study_hours || 'Unknown'}
  - Learning Style: ${profile.learning_style || 'Unknown'}
  
  Adapt your explanation to match this student's level and learning style.
  `
      : '';

    return `You are Pocket Tutor, a friendly and careful tutoring assistant.
  ${profileContext}
  You must follow these rules:
  1. Use only the uploaded document context below.
  2. Do not add outside facts, assumptions, or prior knowledge.
  3. If the answer is not clearly supported by the context, reply exactly:
  "I can only help with what is in your uploaded document."
  4. Teach like a supportive tutor: be encouraging, simple, and precise.
  5. Adapt your language and depth to the student's academic level and learning style.
  6. Start with a short plain-English explanation first.
  7. Then use Bloom-style scaffolding when the context allows:
     - Remember: identify the key fact, term, or idea from the document
     - Understand: explain what it means in simple words
     - Apply: give one short example, analogy, or use-case grounded in the document
  8. Include at least one concrete example or analogy when the document gives enough material.
  9. If the document context is partial, say so briefly instead of guessing.
  
  Use this response style:
  - Simple answer:
  - Remember:
  - Understand:
  - Apply:
  
  DOCUMENT CONTEXT:
  ${context}
  
  STUDENT QUESTION:
  ${question}
  
  Answer using only the document context, adapted to the student's level.`;
  }

  private normalizeText(value: string): string {
    return value.toLowerCase().replace(/[^\w\s]/g, ' ');
  }

  private getQuestionKeywords(question: string): string[] {
    const stopWords = new Set([
      'a',
      'an',
      'and',
      'are',
      'as',
      'at',
      'be',
      'by',
      'do',
      'does',
      'for',
      'from',
      'how',
      'i',
      'in',
      'is',
      'it',
      'of',
      'on',
      'or',
      'that',
      'the',
      'this',
      'to',
      'was',
      'what',
      'when',
      'where',
      'which',
      'who',
      'why',
      'with',
      'you',
      'your',
    ]);

    const uniqueKeywords = new Set(
      this.normalizeText(question)
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 2 && !stopWords.has(word)),
    );

    return Array.from(uniqueKeywords);
  }

  private scoreChunkRelevance(
    chunk: any,
    keywords: string[],
    index: number,
  ): number {
    const content = String(chunk?.content ?? '');
    const normalizedContent = this.normalizeText(content);

    let keywordHits = 0;
    for (const keyword of keywords) {
      if (normalizedContent.includes(keyword)) {
        keywordHits += 1;
      }
    }

    const exactQuestionBoost =
      keywords.length > 0 ? keywordHits / keywords.length : 0;

    const similarityScore = Number(chunk?.similarity ?? chunk?.score ?? 0);
    const recencyPenalty = index * 0.01;

    return similarityScore + exactQuestionBoost * 0.35 - recencyPenalty;
  }

  private rerankChunks(chunks: any[], question: string): any[] {
    const keywords = this.getQuestionKeywords(question);

    return [...chunks]
      .map((chunk, index) => ({
        chunk,
        score: this.scoreChunkRelevance(chunk, keywords, index),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.chunk);
  }

  private formatContext(chunks: any[]): string {
    return chunks
      .map((chunk: any, index: number) => {
        const similarity = Number(chunk?.similarity ?? chunk?.score ?? 0);
        const similarityLabel = Number.isFinite(similarity)
          ? similarity.toFixed(3)
          : 'n/a';

        return [
          `[Source ${index + 1} | chunkIndex: ${chunk.chunk_index ?? 'unknown'} | similarity: ${similarityLabel}]`,
          chunk.content,
        ].join('\n');
      })
      .join('\n\n');
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

    this.logger.log(`Validation passed`);

    this.logger.log(`Embedding question: "${question}"`);
    const questionEmbedding = await this.embedding.embedText(question);

    this.logger.log(`Searching for chunks with:`);
    this.logger.log(`- documentId: ${documentId}`);
    this.logger.log(`- userId: ${userId}`);

    const matchCount = 12;
    const { data: chunks, error } = await this.supabase
      .getClient()
      .rpc('match_document_chunks', {
        query_embedding: questionEmbedding,
        match_document_id: documentId,
        match_user_id: userId,
        match_count: matchCount,
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

    const rerankedChunks = this.rerankChunks(chunks, question).slice(0, 8);

    this.logger.log(
      `Retrieved ${chunks.length} relevant chunks, using top ${rerankedChunks.length} after reranking`,
    );

    const { data: profile } = await this.supabase
      .getClient()
      .from('profiles')
      .select('full_name, academic_system, topic, study_hours, learning_style')
      .eq('id', userId)
      .single();

    const context = this.formatContext(rerankedChunks);
    const prompt = this.buildPrompt(context, question, profile);

    let answer: string;
    let modelUsed: string;

    try {
      answer = await this.askGroq(prompt);
      modelUsed = 'llama-3.3-70b-versatile (groq)';
      this.logger.log(
        `Model used: ${modelUsed} | Document: ${documentId} | Chunks: ${rerankedChunks.length}`,
      );
    } catch (groqErr) {
      this.logger.warn(
        `Groq failed — ${groqErr?.message}, falling back to Gemini...`,
      );

      try {
        answer = await this.askGemini(prompt);
        modelUsed = 'gemini-2.0-flash-lite';
        this.logger.log(
          `Model used: ${modelUsed} | Document: ${documentId} | Chunks: ${rerankedChunks.length}`,
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
      sourcesUsed: rerankedChunks.length,
      sources: rerankedChunks.map((c: any) => ({
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
