import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { LoggerService } from '../common/logging/logger.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor(@Inject(LoggerService) private readonly logger: LoggerService) {
        super({
            log: [
                { level: 'query', emit: 'event' },
                { level: 'info', emit: 'event' },
                { level: 'warn', emit: 'event' },
                { level: 'error', emit: 'event' },
            ],
        });
        // listen to query events
        // Note: $on('query') provides query string and params but not duration; prisma emits 'query' with params
        // we'll measure approximate duration by wrapping $executeRaw where needed; here we log queries when emitted
        // Prisma client emits 'query' events when log: ['query'] is configured; if not, this will still work when events are fired
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this as any).$on && (this as any).$on('query', (e: any) => {
                // e = { query: string, params: string, duration: number }
                this.logger.debug('Prisma query', {
                    operation: 'prisma:query',
                    metadata: { query: e.query, params: e.params },
                    duration: e.duration || null,
                });
            });
        } catch (err) {
            // ignore if $on is not available yet
        }
    }

    async onModuleInit() {
       await this.$connect();
       this.logger.info('Prisma connected', { operation: 'prisma:connect' });
    }
    async onModuleDestroy() {
        await this.$disconnect();
        this.logger.info('Prisma disconnected', { operation: 'prisma:disconnect' });
    }

}
