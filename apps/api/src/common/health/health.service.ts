import { Inject, Injectable, Logger } from '@nestjs/common';
import type { HealthResponse } from '@enterprise-hub/shared';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

type DatabaseProbe = Pick<PrismaService, 'checkConnection'>;
type RedisProbe = Pick<RedisService, 'ping'>;

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @Inject(PrismaService) private readonly database: DatabaseProbe,
    @Inject(RedisService) private readonly redis: RedisProbe,
  ) {}

  async check(): Promise<HealthResponse> {
    const [databaseResult, redisResult] = await Promise.allSettled([
      this.database.checkConnection(),
      this.redis.ping(),
    ]);
    const database = databaseResult.status === 'fulfilled' ? 'up' : 'down';
    const redis = redisResult.status === 'fulfilled' ? 'up' : 'down';

    if (database === 'down') {
      this.logger.error('Database health check failed');
    }
    if (redis === 'down') {
      this.logger.error('Redis health check failed');
    }

    return {
      status: database === 'up' && redis === 'up' ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      services: {
        api: 'up',
        database,
        redis,
      },
    };
  }
}
