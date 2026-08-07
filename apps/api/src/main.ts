import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './core/http/global-exception.filter';
import { ApiConfigService } from './core/config/api-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ApiConfigService);

  // Global prefix /api/v1 (BRD 7)
  app.setGlobalPrefix('api/v1');

  // Validation (class-validator) — strip unknown props, transform payloads
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );

  // Error envelope { error: { code, message, details } } (BRD 7.4)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // OpenAPI (BRD 7)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LAHANS Connect API')
    .setDescription('HRIS PT Lahan Mekar Niaga — NestJS + Prisma + PostgreSQL')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get('PORT');
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`LAHANS Connect API listening on http://localhost:${port}/api/v1`);
}

void bootstrap();
