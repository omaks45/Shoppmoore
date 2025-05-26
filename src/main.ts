/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Limit console logs in production
  if (isProduction) {
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      if (args[0]?.includes?.('Server is running') || args[0]?.includes?.('Bootstrap')) {
        originalConsoleLog(...args);
      }
    };
    console.debug = () => {};
    console.info = () => {};
  }

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
    console.log('CORS Allowed Origins:', allowedOrigins);
  }

  // Swagger is always enabled
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
    logger.log(`Server URL: ${await app.getUrl()}`);
    logger.log('Debug logs enabled');
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

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', err);
  process.exit(1);
});
