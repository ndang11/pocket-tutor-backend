import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type StudyActivityType = 'flashcard' | 'quiz' | 'chat' | 'document';

export interface StudyActivity {
  id: string;
  userId: string;
  type: StudyActivityType;
  title: string;
  description?: string;
  duration?: number;
  score?: number;
  totalQuestions?: number;
  correctAnswers?: number;
  documentId?: string;
  createdAt: Date;
}

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async createActivity(
    activity: Omit<StudyActivity, 'id' | 'createdAt'>,
  ): Promise<StudyActivity> {
    const result = await this.prisma.pool.query(
      `INSERT INTO study_history (id, "userId", type, title, description, duration, score, "totalQuestions", "correctAnswers", "documentId", created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, "userId", type, title, description, duration, score, "totalQuestions", "correctAnswers", "documentId", created_at`,
      [
        activity.userId,
        activity.type,
        activity.title,
        activity.description || null,
        activity.duration || null,
        activity.score || null,
        activity.totalQuestions || null,
        activity.correctAnswers || null,
        activity.documentId || null,
      ],
    );

    const row = result.rows[0];
    return {
      ...activity,
      id: row.id,
      createdAt: row.created_at,
    };
  }

  async getUserHistory(userId: string, limit = 20): Promise<StudyActivity[]> {
    const result = await this.prisma.pool.query(
      `SELECT id, "userId", type, title, description, duration, score, "totalQuestions", "correctAnswers", "documentId", created_at
       FROM study_history WHERE "userId" = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      description: row.description,
      duration: row.duration,
      score: row.score,
      totalQuestions: row.totalQuestions,
      correctAnswers: row.correctAnswers,
      documentId: row.documentId,
      createdAt: row.created_at,
    }));
  }

  async getHistoryByType(
    userId: string,
    type: StudyActivityType,
  ): Promise<StudyActivity[]> {
    const result = await this.prisma.pool.query(
      `SELECT id, "userId", type, title, description, duration, score, "totalQuestions", "correctAnswers", "documentId", created_at
       FROM study_history WHERE "userId" = $1 AND type = $2 ORDER BY created_at DESC`,
      [userId, type],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      type: row.type,
      title: row.title,
      description: row.description,
      duration: row.duration,
      score: row.score,
      totalQuestions: row.totalQuestions,
      correctAnswers: row.correctAnswers,
      documentId: row.documentId,
      createdAt: row.created_at,
    }));
  }

  async deleteActivity(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.pool.query(
      `DELETE FROM study_history WHERE id = $1 AND "userId" = $2 RETURNING id`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async clearUserHistory(userId: string): Promise<number> {
    const result = await this.prisma.pool.query(
      `DELETE FROM study_history WHERE "userId" = $1`,
      [userId],
    );
    return result.rowCount ?? 0;
  }

  async getStudyStats(userId: string) {
    const result = await this.prisma.pool.query(
      `SELECT 
        type,
        COUNT(*) as total_sessions,
        SUM(duration) as total_duration,
        AVG(score) as avg_score,
        MAX(created_at) as last_activity
       FROM study_history 
       WHERE "userId" = $1 
       GROUP BY type`,
      [userId],
    );

    return result.rows;
  }
}
