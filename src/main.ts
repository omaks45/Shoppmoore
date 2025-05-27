/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  const app = await NestFactory.create(AppModule, {
    logger: isProduction
      ? ['error', 'warn'] // limit logs in production
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // CORS
  const allowedOrigins = (configService.get<string>('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''));

  const isLocal = process.env.HOST?.includes('localhost') || process.env.IS_LOCAL === 'true';

  app.enableCors({
    origin: [
      ...allowedOrigins,
      ...(isLocal ? ['http://localhost:3000', 'http://127.0.0.1:5173'] : []),
    ],
    credentials: true,
  });

  if (isDevelopment) {
    logger.debug('CORS Allowed Origins: ' + allowedOrigins.join(', '));
  }

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shoppmoore API')
    .setDescription('E-commerce API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
  logger.log('Swagger documentation available at /api');

  // Start server
  const port = process.env.PORT || configService.get<number>('PORT') || 5000;
  await app.listen(port);
  logger.log(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);

  if (isDevelopment) {
    logger.debug(`🌍 Server URL: ${await app.getUrl()}`);
    logger.debug('🛠 Debug logs enabled');
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.warn('SIGINT received. Shutting down...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received. Shutting down...');
    await app.close();
    process.exit(0);
  });

  // Error handling
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err.stack || err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise);
    logger.error('Reason:', reason);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', err.stack || err);
  process.exit(1);
});
