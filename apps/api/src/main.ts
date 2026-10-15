import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './common/config/env.validation';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(
    ConfigService<EnvironmentVariables, true>,
  );

  app.enableCors({
    origin: configService.get('CORS_ORIGIN', { infer: true }),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(app.get(HttpAdapterHost)));
  app.useGlobalInterceptors(new RequestLoggingInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Enterprise Hub API')
    .setVersion('0.1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('/docs', app, document);

  await app.listen(configService.get('PORT', { infer: true }));
}

void bootstrap();
