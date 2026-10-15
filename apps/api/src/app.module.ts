import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import {
  EnvironmentVariables,
  validateEnvironment,
} from './common/config/env.validation';
import { DatabaseModule } from './common/database/database.module';
import { HealthModule } from './common/health/health.module';
import { RedisModule } from './common/redis/redis.module';
import { DepartmentsModule } from './departments/departments.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SyncModule } from './sync/sync.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validate: validateEnvironment,
    }),
    DatabaseModule,
    RedisModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<EnvironmentVariables, true>,
      ) => ({
        connection: {
          host: configService.get('REDIS_HOST', { infer: true }),
          port: configService.get('REDIS_PORT', { infer: true }),
        },
      }),
    }),
    HealthModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    TasksModule,
    IntegrationsModule,
    SyncModule,
  ],
})
export class AppModule {}
