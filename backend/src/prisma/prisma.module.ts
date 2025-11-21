import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LoggerService } from '../common/logging/logger.service';
import { LoggingModule } from 'src/common/logging/logging.module';

@Module({
  imports: [LoggingModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
