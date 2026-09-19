import {
  Body,
  Controller,
  GoneException,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { SummarizeDto } from './dto/summarize.dto';

@Controller('ai')
export class AiController {
  @UseGuards(JwtAuthGuard)
  @Post('summarize')
  summarize(@Body() dto: SummarizeDto) {
    void dto;
    // The mobile client intentionally keeps all SMS content on device. A
    // silent proxy here would let any authenticated caller bypass that notice.
    throw new GoneException(
      'Remote SMS summarization is disabled in privacy-first mode.',
    );
  }
}
