import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateSessionParams {
  userId: string;
  title: string;
  subject?: string;
  educationLevel?: string;
  stream?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  subject?: string;
  educationLevel?: string;
  stream?: string;
  lastMessage?: string;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class ChatSessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(params: CreateSessionParams): Promise<ChatSession> {
    const result = await this.prisma.pool.query(
      `INSERT INTO chat_sessions ("userId", title, subject, "educationLevel", stream, "messageCount", created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 0, NOW(), NOW())
       RETURNING id, "userId", title, subject, "educationLevel", stream, "lastMessage", "messageCount", created_at as "createdAt", updated_at as "updatedAt"`,
      [
        params.userId,
        params.title,
        params.subject || null,
        params.educationLevel || null,
        params.stream || null,
      ],
    );
    return result.rows[0];
  }

  async getUserSessions(userId: string, limit = 20): Promise<ChatSession[]> {
    const result = await this.prisma.pool.query(
      `SELECT id, "userId", title, subject, "educationLevel", stream, "lastMessage", "messageCount", created_at as "createdAt", updated_at as "updatedAt"
       FROM chat_sessions WHERE "userId" = $1 ORDER BY updated_at DESC LIMIT $2`,
      [userId, limit],
    );
    return result.rows;
  }

  async getSessionById(sessionId: string): Promise<ChatSession | null> {
    const result = await this.prisma.pool.query(
      `SELECT id, "userId", title, subject, "educationLevel", stream, "lastMessage", "messageCount", created_at as "createdAt", updated_at as "updatedAt"
       FROM chat_sessions WHERE id = $1`,
      [sessionId],
    );
    return result.rows[0] || null;
  }

  async updateSession(
    sessionId: string,
    lastMessage: string,
    messageCount: number,
  ): Promise<void> {
    await this.prisma.pool.query(
      `UPDATE chat_sessions SET "lastMessage" = $1, "messageCount" = $2, updated_at = NOW() WHERE id = $3`,
      [lastMessage, messageCount, sessionId],
    );
  }

  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.prisma.pool.query(
      `DELETE FROM chat_sessions WHERE id = $1 AND "userId" = $2 RETURNING id`,
      [sessionId, userId],
    );
    if ((result.rowCount ?? 0) > 0) {
      await this.prisma.pool.query(`DELETE FROM chat_messages WHERE "sessionId" = $1`, [sessionId]);
    }
    return (result.rowCount ?? 0) > 0;
  }

  async addMessage(sessionId: string, role: string, content: string): Promise<ChatMessageRecord> {
    const result = await this.prisma.pool.query(
      `INSERT INTO chat_messages ("sessionId", role, content, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, "sessionId", role, content, created_at as "createdAt"`,
      [sessionId, role, content],
    );
    return result.rows[0];
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessageRecord[]> {
    const result = await this.prisma.pool.query(
      `SELECT id, "sessionId", role, content, created_at as "createdAt"
       FROM chat_messages WHERE "sessionId" = $1 ORDER BY created_at ASC`,
      [sessionId],
    );
    return result.rows;
  }
}