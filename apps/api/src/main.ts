import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './modules/app.module';

function getAllowedCorsOrigins() {
  const configuredOrigins = process.env.API_CORS_ORIGINS;
  if (configuredOrigins) {
    return configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  return ['http://localhost:3000', 'https://web.sarainoq.cn'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedCorsOrigins = getAllowedCorsOrigins();

  app.enableCors({
    origin: allowedCorsOrigins,
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
