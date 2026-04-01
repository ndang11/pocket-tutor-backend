// src/flashcards/flashcards.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { FlashcardService } from './flashcard.service';

@Controller('flashcards')
export class FlashcardController {
  constructor(private readonly flashcardsService: FlashcardService) {}

  @Post('generate')
  async generate(@Body() body: { documentId: string; userId: string }) {
    return this.flashcardsService.generateForDocument(
      body.documentId,
      body.userId,
    );
  }

  @Get(':documentId')
  get(@Param('documentId') documentId: string) {
    return this.flashcardsService.getByDocument(documentId);
  }
}
