import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { Pool } from 'pg';

@Injectable()
export class FlashcardService {
  private readonly groq: OpenAI;
  private pool: Pool;

  constructor(
    private supabase: SupabaseService,
    private prisma: PrismaService,
  ) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Missing GROQ_API_KEY');
    this.groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }

  async generateForDocument(documentId: string, userId: string) {
    console.log(
      '[FlashcardService] Generating for documentId:',
      documentId,
      'userId:',
      userId,
    );

    // 1. Fetch document content from document_chunks table
    const { data: chunks, error: chunksError } = await this.supabase
      .getClient()
      .from('document_chunks')
      .select('content')
      .eq('document_id', documentId)
      .limit(10);

    console.log(
      '[FlashcardService] Found chunks:',
      chunks?.length,
      'error:',
      chunksError,
    );

    if (chunksError) {
      throw new Error(
        `Failed to fetch document chunks: ${chunksError.message}`,
      );
    }

    if (!chunks || chunks.length === 0) {
      throw new Error(
        'No content found for this document. Please upload and process the document first.',
      );
    }

    const context = chunks.map((c) => c.content).join('\n\n');
    console.log('[FlashcardService] Context length:', context.length);

    // 2. Prompt Groq to generate Flashcards
    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are an educational assistant. Create 5-8 flashcards based on the text provided. Return ONLY a JSON array of objects with "front" and "back" keys.',
        },
        { role: 'user', content: `Context: ${context}` },
      ],
      response_format: { type: 'json_object' },
    });

    const rawOutput =
      completion.choices[0].message.content ?? '{"flashcards": []}';
    console.log('[FlashcardService] Raw AI output:', rawOutput);

    let flashcards;
    try {
      const parsed = JSON.parse(rawOutput);
      flashcards = parsed.flashcards || parsed.cards || [];
    } catch (e) {
      console.error('[FlashcardService] Failed to parse AI response:', e);
      throw new Error('Failed to parse AI response');
    }

    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      throw new Error('No flashcards could be generated from this document');
    }

    console.log(
      '[FlashcardService] Generated',
      flashcards.length,
      'flashcards',
    );

    // 3. Save to flashcards table using raw SQL to bypass foreign key constraints
    const cardsToCreate = flashcards.map((card: any) => ({
      id: uuidv4(),
      front: card.front,
      back: card.back,
      documentId: documentId,
      userId: userId,
    }));

    console.log('[FlashcardService] Creating cards:', cardsToCreate.length);
    try {
      for (const card of cardsToCreate) {
        await this.pool.query(
          `INSERT INTO flashcards (id, front, back, "documentId", "userId", created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [card.id, card.front, card.back, card.documentId, card.userId],
        );
      }
      console.log('[FlashcardService] Created:', cardsToCreate.length, 'cards');
    } catch (err: any) {
      console.error(
        '[FlashcardService] Error inserting flashcards:',
        err.message || err,
      );
      throw new Error(`Failed to save flashcards: ${err.message}`);
    }

    return flashcards;
  }

  getByDocument(documentId: string) {
    return this.pool.query(
      `SELECT id, front, back, "documentId", "userId", created_at
       FROM flashcards WHERE "documentId" = $1 ORDER BY created_at DESC`,
      [documentId],
    );
  }

  getByUser(userId: string) {
    return this.pool.query(
      `SELECT id, front, back, "documentId", "userId", created_at
       FROM flashcards WHERE "userId" = $1 ORDER BY created_at DESC`,
      [userId],
    );
  }
}
