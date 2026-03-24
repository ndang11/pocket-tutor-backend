import { Controller, Post, Body, BadRequestException, Logger } from '@nestjs/common';
import { QuizService } from './quiz.service';

@Controller('quiz')
export class QuizController {
  private readonly logger = new Logger(QuizController.name);

  constructor(private readonly quizService: QuizService) {}

  @Post('generate')
  async generateQuiz(
    @Body('documentId') documentId: string,
    @Body('userId') userId: string,
    @Body('questionCount') questionCount: number = 5,
    @Body('educationLevel') educationLevel: string = 'UpperSixth',
  ) {
    if (!documentId?.trim() || !userId?.trim()) {
      throw new BadRequestException('documentId and userId are required');
    }

    this.logger.log(`Generating quiz for document: ${documentId}`);
    return this.quizService.generateQuiz(documentId, userId, questionCount, educationLevel);
  }

  @Post('submit')
  async submitQuiz(
    @Body('answers') answers: {
      questionId: string;
      answer: string;
      correctAnswer: string;
      bloomLevel: string;
      explanation: string;
    }[],
  ) {
    if (!answers || answers.length === 0) {
      throw new BadRequestException('answers are required');
    }

    this.logger.log(`Scoring quiz with ${answers.length} answers`);
    return this.quizService.submitQuiz(answers);
  }
}