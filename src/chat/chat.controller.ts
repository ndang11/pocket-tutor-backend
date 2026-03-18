import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('ask')
  async ask(
    @Body('documentId') documentId: string,
    @Body('userId') userId: string,
    @Body('question') question: string,
  ) {
    return this.chatService.ask(documentId, userId, question);
  }
}