import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EmbeddingService } from '../embedding/embedding.service';
import OpenAI from 'openai';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly groq: OpenAI;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly embedding: EmbeddingService,
  ) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Missing GROQ_API_KEY');
    this.groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  // ---------------------------------------------------------------------------
  // Prompt builders
  // ---------------------------------------------------------------------------

  private buildDocumentPrompt(
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

  private buildFreeChatPrompt(
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    profile?: any,
  ): { role: 'user' | 'assistant' | 'system'; content: string }[] {
    const profileContext = profile
      ? `The student's name is ${profile.full_name || 'there'}, studying at ${profile.academic_system || 'general'} level.`
      : '';

    const systemMessage = {
      role: 'system' as const,
      content: `You are "Pocket Tutor," a brilliant academic mentor and supportive older brother for students in Cameroon. ${profileContext}

TONE & PERSONALITY:
- Be warm, relatable, and encouraging.
- Address the student by name when you know it.
- You can discuss any topic — academic subjects, general knowledge, career advice, or just a friendly conversation.
- When discussing academic topics, use Cameroonian examples and analogies where relevant (e.g., transport at Mvan, Indomitable Lions, Marché Central).
- Keep answers focused and helpful. If a question is outside your knowledge, say so honestly.
- You do NOT need documents to have a conversation. Just be a great tutor and friend.`,
    };

    return [
      systemMessage,
      ...history,
      { role: 'user' as const, content: question },
    ];
  }

  // ---------------------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------------------

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
      if (normalizedContent.includes(keyword)) keywordHits += 1;
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

  // ---------------------------------------------------------------------------
  // AI calls
  // ---------------------------------------------------------------------------

  private async askGroq(
    messages: { role: 'user' | 'assistant' | 'system'; content: string }[],
  ): Promise<string> {
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
    });
    return completion.choices[0].message.content ?? '';
  }

  // ---------------------------------------------------------------------------
  // Public methods
  // ---------------------------------------------------------------------------

  /**
   * Document-grounded Q&A — requires a documentId.
   * Searches the user's uploaded document chunks and builds context for the AI.
   */
  async ask(documentId: string, userId: string, question: string) {
    if (!userId?.trim() || !question?.trim()) {
      throw new BadRequestException('userId and question are required');
    }

    const questionEmbedding = await this.embedding.embedText(question);

    const { data: chunks, error } = await this.supabase
      .getClient()
      .rpc('match_document_chunks', {
        query_embedding: questionEmbedding,
        match_document_id: documentId,
        match_user_id: userId,
        match_count: 12,
      });

    if (error) {
      this.logger.error('Vector search failed', error.message);
      throw new BadRequestException(`Vector search failed: ${error.message}`);
    }

    this.logger.log(`Found ${chunks?.length || 0} chunks`);

    if (!chunks || chunks.length === 0) {
      throw new BadRequestException(
        'No relevant content found in this document for your question.',
      );
    }

    const rerankedChunks = this.rerankChunks(chunks, question).slice(0, 8);

    this.logger.log(
      `Using top ${rerankedChunks.length} chunks after reranking`,
    );

    const { data: profile } = await this.supabase
      .getClient()
      .from('profiles')
      .select('full_name, academic_system, topic, study_hours, learning_style')
      .eq('id', userId)
      .single();

    const context = this.formatContext(rerankedChunks);
    const prompt = this.buildDocumentPrompt(context, question, profile);

    let answer: string;

    try {
      answer = await this.askGroq([{ role: 'user', content: prompt }]);
      this.logger.log(
        `Document chat answered | Document: ${documentId} | Chunks: ${rerankedChunks.length}`,
      );
    } catch (err) {
      this.logger.error('Groq failed', err?.message);
      throw new BadRequestException(
        'AI service temporarily unavailable. Please try again in a moment.',
      );
    }

    return {
      question,
      answer,
      modelUsed: 'llama-3.3-70b-versatile (groq)',
      sourcesUsed: rerankedChunks.length,
      sources: rerankedChunks.map((c: any) => ({
        chunkIndex: c.chunk_index,
        preview: c.content.slice(0, 100),
      })),
    };
  }

  /**
   * Free chat — no document required.
   * Supports multi-turn conversation via an optional history array.
   * If documentId is provided, relevant chunks are fetched and injected as context.
   */
  async freeChat(
    userId: string,
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[] = [],
    documentId?: string,
  ) {
    if (!userId?.trim() || !question?.trim()) {
      throw new BadRequestException('userId and question are required');
    }

    const { data: profile } = await this.supabase
      .getClient()
      .from('profiles')
      .select('full_name, academic_system, topic, study_hours, learning_style')
      .eq('id', userId)
      .single();

    // If a documentId is provided, optionally enrich the conversation with context
    let documentContext = '';
    if (documentId?.trim()) {
      try {
        const questionEmbedding = await this.embedding.embedText(question);

        const { data: chunks } = await this.supabase
          .getClient()
          .rpc('match_document_chunks', {
            query_embedding: questionEmbedding,
            match_document_id: documentId,
            match_user_id: userId,
            match_count: 6,
          });

        if (chunks && chunks.length > 0) {
          const reranked = this.rerankChunks(chunks, question).slice(0, 4);
          documentContext = this.formatContext(reranked);
          this.logger.log(
            `Free chat enriched with ${reranked.length} document chunks`,
          );
        }
      } catch (err) {
        // Non-fatal — just proceed without document context
        this.logger.warn(`Document context fetch failed: ${err?.message}`);
      }
    }

    // Inject document context into the question if available
    const enrichedQuestion = documentContext
      ? `${question}\n\n[Optional context from the student's notes]:\n${documentContext}`
      : question;

    const messages = this.buildFreeChatPrompt(
      enrichedQuestion,
      history,
      profile,
    );

    let answer: string;

    try {
      answer = await this.askGroq(messages);
      this.logger.log(
        `Free chat answered | userId: ${userId} | historyLength: ${history.length}`,
      );
    } catch (err) {
      this.logger.error('Groq failed', err?.message);
      throw new BadRequestException(
        'AI service temporarily unavailable. Please try again in a moment.',
      );
    }

    return {
      question,
      answer,
      modelUsed: 'llama-3.3-70b-versatile (groq)',
      documentContextUsed: !!documentContext,
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
