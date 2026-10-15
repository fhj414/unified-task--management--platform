import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { EnvironmentVariables } from '../config/env.validation';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST', { infer: true }),
      port: this.configService.get('REDIS_PORT', { infer: true }),
      lazyConnect: true,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async ping(): Promise<void> {
    const response = await this.client.ping();

    if (response !== 'PONG') {
      throw new Error('Redis ping returned an unexpected response');
    }
  }
}
