import { Controller, Get, Param } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';

@Controller('syllabus')
export class SyllabusController {
  constructor(private readonly syllabusService: SyllabusService) {}

  @Get('levels')
  async getAllEducationLevels() {
    return this.syllabusService.getAllEducationLevels();
  }

  @Get('levels/:id')
  async getEducationLevelById(@Param('id') id: string) {
    return this.syllabusService.getEducationLevelById(id);
  }

  @Get('levels/:levelId/streams')
  async getStreamsByLevelId(@Param('levelId') levelId: string) {
    return this.syllabusService.getStreamsByLevelId(levelId);
  }

  @Get('streams/:streamId/subjects')
  async getSubjectsByStreamId(@Param('streamId') streamId: string) {
    return this.syllabusService.getSubjectsByStreamId(streamId);
  }

  @Get('seed')
  async seedEducationLevels() {
    return this.syllabusService.seedEducationLevels();
  }
}