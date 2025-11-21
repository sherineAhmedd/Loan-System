// logging.module.ts
import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Module({
  providers: [LoggerService],
  exports: [LoggerService], // <-- make it available for other modules
})
export class LoggingModule {}
