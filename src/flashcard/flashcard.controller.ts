// src/flashcards/flashcards.controller.ts
import { Controller, Post, Get, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { FlashcardService } from './flashcard.service';

@Controller('flashcards')
export class FlashcardController {
  constructor(private readonly flashcardsService: FlashcardService) {}

  @Post('generate')
  async generate(@Body() body: { documentId: string; userId: string }) {
    console.log('[FlashcardController] generate called:', body);
    try {
      const result = await this.flashcardsService.generateForDocument(
        body.documentId,
        body.userId,
      );
      console.log(
        '[FlashcardController] generate result:',
        result?.length,
        'cards',
      );

      // Fetch the saved flashcards with their IDs
      const savedCards = await this.flashcardsService.getByDocument(
        body.documentId,
      );
      console.log(
        '[FlashcardController] returning saved cards:',
        savedCards?.rows?.length,
      );

      return { flashcards: savedCards?.rows || [] };
    } catch (err: any) {
      console.error('[FlashcardController] generate error:', err.message);
      // Return 400 for business logic errors, 500 for unexpected
      if (err.message.includes('No content found')) {
        throw new HttpException({
          statusCode: 400,
          message: err.message,
        }, HttpStatus.BAD_REQUEST);
      }
      if (err.message.includes('Failed to save')) {
        throw new HttpException({
          statusCode: 500,
          message: 'Failed to save flashcards',
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }
      throw err;
    }
  }

  @Get('user/:userId')
  async getByUser(@Param('userId') userId: string) {
    console.log('[FlashcardController] getByUser called with userId:', userId);
    const flashcards = await this.flashcardsService.getByUser(userId);
    console.log('[FlashcardController] getByUser result:', {
      count: flashcards?.rows?.length,
    });
    return { flashcards: flashcards?.rows || [] };
  }

  @Get(':documentId')
  async get(@Param('documentId') documentId: string) {
    const flashcards = await this.flashcardsService.getByDocument(documentId);
    return { flashcards: flashcards?.rows || [] };
  }
}
