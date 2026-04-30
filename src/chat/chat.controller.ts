import {
  Controller,
  Post,
  Get,
  Body,
  BadRequestException,
  Logger,
  Param,
} from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  async ask(
    @Body('documentId') documentId: string,
    @Body('userId') userId: string,
    @Body('sessionId') sessionId: string,
    @Body('question') question: string,
  ) {
    this.logger.log(
      `[ask] doc=${documentId}, user=${userId}, q="${question?.slice(0, 40)}..."`,
    );

    if (!documentId || documentId.trim() === '' || documentId === 'undefined') {
      this.logger.warn(
        `[ask] Redirecting to freeChat because documentId is missing`,
      );
      return this.chatService.freeChat(userId, question, []);
    }

    return this.chatService.ask(documentId, userId, question, sessionId);
  }

  @Post('free')
  async freeChat(
    @Body('userId') userId: string,
    @Body('question') question: string,
    @Body('sessionId') sessionId: string,
    @Body('documentId') documentId?: string,
    @Body('history')
    history: { role: 'user' | 'assistant'; content: string }[] = [],
  ) {
    this.logger.log(
      `[free] user=${userId}, doc=${documentId ?? 'none'}, history=${history?.length}`,
    );

    if (!userId?.trim() || !question?.trim()) {
      throw new BadRequestException('userId and question are required');
    }

    const safeHistory = Array.isArray(history) ? history : [];

    return this.chatService.freeChat(
      userId,
      question,
      safeHistory,
      documentId,
      sessionId,
    );
  }

  @Get('syllabus/:userId/:subjectName')
  async getSubjectSyllabus(
    @Param('userId') userId: string,
    @Param('subjectName') subjectName: string,
  ) {
    this.logger.log(`[syllabus] user=${userId}, subject=${subjectName}`);

    return this.chatService.getSubjectSyllabus(userId, subjectName);
  }
}
