import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import OpenAI from 'openai';

@Injectable()
export class FlashcardService {
  private readonly groq: OpenAI;

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Missing GROQ_API_KEY');
    this.groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async generateForDocument(documentId: string, userId: string) {
    // 1. Fetch document content from your document_chunks table
    const { data: chunks, error } = await this.supabase
      .getClient()
      .from('document_chunks')
      .select('content')
      .eq('document_id', documentId)
      .limit(10); // Take top 10 chunks for context

    if (error || !chunks) throw new Error('Could not find document content');

    const context = chunks.map((c) => c.content).join('\n\n');

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
    const { flashcards } = JSON.parse(rawOutput);

    // 3. Save to your brand new PostgreSQL table
    await (this.prisma as any).flashcard.createMany({
      data: flashcards.map((card: any) => ({
        front: card.front,
        back: card.back,
        documentId: documentId,
        userId: userId,
      })),
    });

    return flashcards;
  }

  getByDocument(documentId: string) {
    return (this.prisma as any).flashcard.findMany({
      where: { documentId },
      orderBy: { created_at: 'desc' },
    });
  }
}
