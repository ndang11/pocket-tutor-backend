import {
  Controller,
  Post,
  Body,
  BadRequestException,
  Logger,
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
    @Body('question') question: string,
  ) {
    this.logger.log(
      `Received request: documentId=${documentId}, userId=${userId}, question=${question?.substring(0, 50)}...`,
    );

    if (!documentId?.trim() || !userId?.trim() || !question?.trim()) {
      this.logger.error(
        `Missing fields - documentId: ${!!documentId}, userId: ${!!userId}, question: ${!!question}`,
      );
      throw new BadRequestException(
        'documentId, userId and question are required',
      );
    }

    return this.chatService.ask(documentId, userId, question);
  }
}
