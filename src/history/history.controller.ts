import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { HistoryService, StudyActivityType } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Post()
  async createActivity(
    @Body()
    body: {
      userId: string;
      type: StudyActivityType;
      title: string;
      description?: string;
      duration?: number;
      score?: number;
      totalQuestions?: number;
      correctAnswers?: number;
      documentId?: string;
    },
  ) {
    const activity = await this.historyService.createActivity(body);
    return { success: true, activity };
  }

  @Get('user/:userId')
  async getUserHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const history = await this.historyService.getUserHistory(
      userId,
      limit ? parseInt(limit, 10) : 20,
    );
    return { history };
  }

  @Get('user/:userId/:type')
  async getHistoryByType(
    @Param('userId') userId: string,
    @Param('type') type: StudyActivityType,
  ) {
    const history = await this.historyService.getHistoryByType(userId, type);
    return { history };
  }

  @Get('stats/:userId')
  async getStudyStats(@Param('userId') userId: string) {
    const stats = await this.historyService.getStudyStats(userId);
    return { stats };
  }

  @Delete(':id')
  async deleteActivity(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    const deleted = await this.historyService.deleteActivity(id, body.userId);
    return { success: deleted };
  }

  @Delete('clear/:userId')
  async clearUserHistory(@Param('userId') userId: string) {
    const count = await this.historyService.clearUserHistory(userId);
    return { success: true, deleted: count };
  }
}
