import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('api')
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  async health() {
    const start = Date.now();
    let database = 'unavailable';
    try {
      // simple DB ping
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch (err) {
      database = 'error';
    }

    return {
      timestamp: new Date().toISOString(),
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'loan-backend',
      database,
      uptime: process.uptime(),
      duration_ms: Date.now() - start,
    };
  }
}
