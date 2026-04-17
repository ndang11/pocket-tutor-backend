import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ChatSessionService } from './chat-session.service';

@Controller('chat-sessions')
export class ChatSessionController {
  constructor(private readonly chatSessionService: ChatSessionService) {}

  @Post()
  async createSession(
    @Body()
    body: {
      userId: string;
      title: string;
      subject?: string;
      educationLevel?: string;
      stream?: string;
    },
  ) {
    const session = await this.chatSessionService.createSession(body);
    return { success: true, session };
  }

  @Get('user/:userId')
  async getUserSessions(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const sessions = await this.chatSessionService.getUserSessions(
      userId,
      limit ? parseInt(limit, 10) : 20,
    );
    return { sessions };
  }

  @Get(':sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    const session = await this.chatSessionService.getSessionById(sessionId);
    return { session };
  }

  @Get(':sessionId/messages')
  async getSessionMessages(@Param('sessionId') sessionId: string) {
    const messages = await this.chatSessionService.getSessionMessages(sessionId);
    return { messages };
  }

  @Delete(':sessionId')
  async deleteSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { userId: string },
  ) {
    const deleted = await this.chatSessionService.deleteSession(
      sessionId,
      body.userId,
    );
    return { success: deleted };
  }

  @Post(':sessionId/messages')
  async addMessage(
    @Param('sessionId') sessionId: string,
    @Body() body: { role: string; content: string },
  ) {
    const message = await this.chatSessionService.addMessage(
      sessionId,
      body.role,
      body.content,
    );
    return { success: true, message };
  }

  @Patch(':sessionId')
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() body: { lastMessage?: string; messageCount?: number },
  ) {
    if (body.lastMessage !== undefined && body.messageCount !== undefined) {
      await this.chatSessionService.updateSession(
        sessionId,
        body.lastMessage,
        body.messageCount,
      );
    }
    return { success: true };
  }
}