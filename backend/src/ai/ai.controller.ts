import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { AiService } from './ai.service';
import { SummarizeDto } from './dto/summarize.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @UseGuards(JwtAuthGuard)
  @Post('summarize')
  summarize(@Body() dto: SummarizeDto) {
    return this.aiService.summarize(dto.messages, dto.maxSentences);
  }
}
