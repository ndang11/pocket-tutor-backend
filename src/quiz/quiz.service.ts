import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import OpenAI from 'openai';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  bloomLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
  explanation: string;
}

export interface GenerateQuizResponse {
  documentId: string;
  questions: QuizQuestion[];
  totalQuestions: number;
}

export interface SubmitQuizResponse {
  score: number;
  total: number;
  percentage: number;
  bloomBreakdown: Record<string, { correct: number; total: number }>;
  results: {
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    studentAnswer: string;
    explanation: string;
  }[];
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);
  private readonly groq: OpenAI;

  constructor(private readonly supabase: SupabaseService) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) throw new Error('Missing GROQ_API_KEY');
    this.groq = new OpenAI({
      apiKey: groqKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }

  async generateQuiz(
    documentId: string,
    userId: string,
    questionCount: number = 5,
    educationLevel: string = 'UpperSixth',
  ): Promise<GenerateQuizResponse> {
    if (!documentId?.trim() || !userId?.trim()) {
      throw new BadRequestException('documentId and userId are required');
    }

    const { data: chunks, error } = await this.supabase
      .getClient()
      .from('document_chunks')
      .select('content, chunk_index')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .order('chunk_index', { ascending: true });

    if (error) throw new BadRequestException(`Failed to fetch chunks: ${error.message}`);
    if (!chunks || chunks.length === 0) {
      throw new BadRequestException('No content found for this document.');
    }

    this.logger.log(`Generating quiz from ${chunks.length} chunks for document ${documentId}`);

    const context = chunks.map((c) => c.content).join('\n\n');

    const bloomDistribution = this.getBloomDistribution(educationLevel, questionCount);

    const prompt = `You are a strict pedagogical AI for Cameroonian students.
Based ONLY on the document content below, generate exactly ${questionCount} multiple choice questions.

BLOOM'S TAXONOMY DISTRIBUTION:
${JSON.stringify(bloomDistribution)}

RULES:
- Every question must come directly from the document content
- Each question must have exactly 4 options (A, B, C, D)
- Only one correct answer per question
- Include a brief explanation for the correct answer
- Assign a Bloom level (L1-L6) to each question

DOCUMENT CONTENT:
${context}

Respond with ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "id": "q1",
    "question": "...",
    "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
    "correctAnswer": "A. ...",
    "bloomLevel": "L1",
    "explanation": "..."
  }
]`;

    const completion = await this.groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content ?? '[]';

    let questions: QuizQuestion[];
    try {
      const clean = raw.replace(/```json|```/g, '').trim();
      questions = JSON.parse(clean);
    } catch {
      this.logger.error('Failed to parse quiz JSON', raw);
      throw new BadRequestException('Failed to generate quiz. Please try again.');
    }

    this.logger.log(`Generated ${questions.length} questions for document ${documentId}`);

    return {
      documentId,
      questions,
      totalQuestions: questions.length,
    };
  }

  async submitQuiz(
    answers: { questionId: string; answer: string; correctAnswer: string; bloomLevel: string; explanation: string }[],
  ): Promise<SubmitQuizResponse> {
    let correct = 0;
    const bloomBreakdown: Record<string, { correct: number; total: number }> = {};

    const results = answers.map((a) => {
      const isCorrect = a.answer.trim().toLowerCase() === a.correctAnswer.trim().toLowerCase();
      if (isCorrect) correct++;

      if (!bloomBreakdown[a.bloomLevel]) {
        bloomBreakdown[a.bloomLevel] = { correct: 0, total: 0 };
      }
      bloomBreakdown[a.bloomLevel].total++;
      if (isCorrect) bloomBreakdown[a.bloomLevel].correct++;

      return {
        questionId: a.questionId,
        correct: isCorrect,
        correctAnswer: a.correctAnswer,
        studentAnswer: a.answer,
        explanation: a.explanation,
      };
    });

    return {
      score: correct,
      total: answers.length,
      percentage: Math.round((correct / answers.length) * 100),
      bloomBreakdown,
      results,
    };
  }

  private getBloomDistribution(level: string, total: number): Record<string, number> {
    const distributions: Record<string, number[]> = {
      Form4:      [0.5, 0.3, 0.2, 0.0, 0.0, 0.0],
      Form5:      [0.4, 0.3, 0.2, 0.1, 0.0, 0.0],
      LowerSixth: [0.3, 0.3, 0.2, 0.2, 0.0, 0.0],
      UpperSixth: [0.2, 0.2, 0.2, 0.2, 0.2, 0.0],
      HND1:       [0.1, 0.2, 0.2, 0.2, 0.2, 0.1],
      HND2:       [0.1, 0.1, 0.2, 0.2, 0.2, 0.2],
      BSc:        [0.1, 0.1, 0.1, 0.2, 0.3, 0.2],
    };

    const weights = distributions[level] ?? distributions['UpperSixth'];
    const levels = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];
    const result: Record<string, number> = {};
    levels.forEach((l, i) => {
      const count = Math.round(weights[i] * total);
      if (count > 0) result[l] = count;
    });
    return result;
  }
}