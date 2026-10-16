import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication } from './app.configuration';
import { EnvironmentVariables } from './common/config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(
    ConfigService<EnvironmentVariables, true>,
  );

  configureApplication(app, configService);

  await app.listen(configService.get('PORT', { infer: true }));
}

void bootstrap();
