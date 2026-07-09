import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'bantAI Backend',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date(),
    };
  }
}