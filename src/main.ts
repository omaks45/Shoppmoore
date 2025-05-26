/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Disable NestJS built-in logger in production for performance
    logger: process.env.NODE_ENV === 'production' 
      ? ['error', 'warn'] 
      : ['error', 'warn', 'log', 'debug', 'verbose']
  });
  
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Disable debug logs early in production
  if (isProduction) {
    // Override console methods to prevent debug logs in production
    const originalConsoleLog = console.log;
    
    console.log = (...args: any[]) => {
      // Only allow critical application logs in production
      if (args[0]?.includes?.('Server is running') || args[0]?.includes?.('Bootstrap')) {
        originalConsoleLog(...args);
      }
    };
    console.debug = () => {}; // Completely disable debug logs
    console.info = () => {};  // Disable info logs
    console.warn = console.warn; // Keep warnings
    console.error = console.error; // Keep errors
  }

  // Global Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // CORS setup with dynamic origin logic
  const allowedOriginsFromEnv = (configService.get<string>('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, '')); // Clean up trailing slashes

  const isLocal =
    process.env.HOST?.includes('localhost') || process.env.IS_LOCAL === 'true';

  const corsOptions: any = {
    origin: [
      ...allowedOriginsFromEnv,
      ...(isLocal ? ['http://localhost:3000', 'http://127.0.0.1:5173'] : []),
    ],
    credentials: true,
  };

  // Only log CORS origins in development
  if (isDevelopment) {
    console.log('CORS Allowed Origins:', corsOptions.origin);
  }

  app.enableCors(corsOptions);

  // Swagger setup - Only enable in development and staging
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Shoppmoore API')
      .setDescription('E-commerce API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
    
    if (isDevelopment) {
      logger.log('Swagger documentation available at /api');
    }
  }

  // Start the server
  const port = process.env.PORT || configService.get<number>('PORT') || 5000;
  await app.listen(port);
  
  // Only log server start message (this is allowed even in production)
  logger.log(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);

  // Log additional info only in development
  if (isDevelopment) {
    logger.log(`Server URL: ${await app.getUrl()}`);
    logger.log('Debug logs enabled');
  } else if (isProduction) {
    logger.log('Production mode: Debug logs disabled');
  }

  // Graceful shutdown hooks
  process.on('SIGINT', async () => {
    logger.warn('SIGINT received. Shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.warn('SIGTERM received. Shutting down gracefully...');
    await app.close();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application:', error);
  process.exit(1);
});