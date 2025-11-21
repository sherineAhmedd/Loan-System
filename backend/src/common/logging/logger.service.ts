import { Injectable } from '@nestjs/common';
import * as winston from 'winston';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogPayload {
  timestamp?: string;
  level?: LogLevel;
  service?: string;
  operation?: string;
  transactionId?: string;
  userId?: string;
  duration?: number; // ms
  metadata?: Record<string, any>;
  error?: { message?: string; stack?: string; code?: string } | null;
}

@Injectable()
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    const { combine, timestamp, printf, json } = winston.format;

    const myFormat = printf(({ level, message, timestamp, ...meta }) => {
      // keep message as-is, meta contains payload
      try {
        const payload = meta[Symbol.for('splat')]?.[0] || meta;
        return JSON.stringify({ timestamp, level, message, ...payload });
      } catch (err) {
        return `${timestamp} ${level}: ${message} ${JSON.stringify(meta)}`;
      }
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(timestamp(), json()),
      transports: [new winston.transports.Console()],
    });
  }

  private normalizedPayload(payload?: Partial<LogPayload>) {
    return {
      timestamp: payload?.timestamp || new Date().toISOString(),
      service: payload?.service || 'loan-backend',
      operation: payload?.operation || null,
      transactionId: payload?.transactionId || null,
      userId: payload?.userId || null,
      duration: payload?.duration || null,
      metadata: payload?.metadata || null,
      error: payload?.error || null,
    };
  }

  debug(message: string, payload?: Partial<LogPayload>) {
    this.logger.debug(message, this.normalizedPayload(payload));
  }

  info(message: string, payload?: Partial<LogPayload>) {
    this.logger.info(message, this.normalizedPayload(payload));
  }

  warn(message: string, payload?: Partial<LogPayload>) {
    this.logger.warn(message, this.normalizedPayload(payload));
  }

  error(message: string, payload?: Partial<LogPayload>) {
    this.logger.error(message, this.normalizedPayload(payload));
  }
}
