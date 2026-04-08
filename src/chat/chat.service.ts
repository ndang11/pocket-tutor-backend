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
  private buildPrompt(
    context: string,
    question: string,
    profile?: any,
  ): string {
    const profileContext = profile
      ? `
  STUDENT PROFILE:
  - Name: ${profile.full_name || 'Student'}
  - Level: ${profile.academic_system || 'General'}
  - Style: ${profile.learning_style || 'Supportive'}
  `
      : '';

    return `You are "Pocket Tutor," a brilliant academic mentor and supportive older brother for students in Cameroon.
  
  ${profileContext}
  
  TONE & PERSONALITY:
  - Be warm, relatable, and encouraging. Use phrases like "Check this out," "Let's dive in," or "Don't worry, I've got you."
  - Address the student by name.
  - Your goal is not just to answer, but to teach.
  
  INSTRUCTION (The "Hybrid" Approach):
  1. PRIMARY SOURCE: Use the [DOCUMENT CONTEXT] below to answer the student's question accurately based on their specific notes.
  2. ENRICHMENT: If the document is brief, use your own extensive knowledge to explain the "Why" and "How." Provide extra context that isn't in the notes to help the student truly master the topic.
  3. GAP FILLING: If the answer is NOT in the document at all, do NOT give up. Use your internal knowledge to provide a high-quality academic answer, but kindly mention: "This wasn't in your specific notes, but here is a clear explanation to help you out!"
  
  RESPONSE STRUCTURE:
  - **Friendly Opening**: (Address the student, validate their question)
  - **The Core Answer**: (Clear explanation using the notes + your extra research)
  - **Cameroonian Analogy**: (Explain the concept using a local example: e.g., transport at Mvan, the price of plantains at Marché Central, or Indomitable Lions teamwork)
  - **Deep Dive/Tutor Tip**: (Add one "Extra" fact that will help them pass their exam)
  
  [DOCUMENT CONTEXT]:
  ${context}
  
  STUDENT QUESTION:
  ${question}
  
  Answer as the ultimate friendly mentor.`;
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
      this.logger.warn(
        `No specific notes found for this question. Pocket Tutor will provide a general explanation.`,
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
