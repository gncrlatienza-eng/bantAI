import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiRoot() {
    return {
      service: 'bantAI Backend',
      status: 'ok',
      version: '1.0.0',
      endpoints: {
        health: '/api/health',
        readiness: '/api/health/ready',
        documentation: '/api/docs',
      },
    };
  }
}
