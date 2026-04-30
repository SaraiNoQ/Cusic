import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { validateEnv } from './common/env-validation';
import { Logger } from 'nestjs-pino';
import { AppModule } from './modules/app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';

function getAllowedCorsOrigins(): (string | RegExp)[] {
  const configuredOrigins = process.env.API_CORS_ORIGINS;
  if (configuredOrigins) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  // Default: allow localhost dev and Cloudflare Tunnel production origins.
  // Also allow any sarainoq.cn subdomain so direct API access works as a
  // fallback even when the Next.js rewrite proxy is bypassed.
  return [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://web.sarainoq.cn',
    'https://api.sarainoq.cn',
    /^https:\/\/.*\.sarainoq\.cn$/,
  ];
}

async function bootstrap() {
  validateEnv();
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.use(compression());
  app.use(json({ limit: '1mb' }));
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableCors({
    origin: getAllowedCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cusic-Timezone'],
    credentials: false,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Music AI App API')
    .setDescription('Bootstrap Swagger surface for the NestJS API skeleton.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(Number(process.env.API_PORT ?? 3001));
}

bootstrap();
