/* eslint-disable prettier/prettier */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Global Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  //Automatically configure CORS
  const allowedOrigins = (configService.get<string>('ALLOWED_ORIGINS') || '')
    .split(',')
    .map(origin => origin.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // Swagger setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shoppmoore API')
    .setDescription('E-commerce API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-api-key' }, 'x-api-key')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  // Start the server
  const port = process.env.PORT || configService.get<number>('PORT') || 5000;
  await app.listen(port);
  logger.log(`Server is running on: ${await app.getUrl()}`);

  // Graceful shutdown hooks
  process.on('SIGINT', async () => {
    logger.warn('SIGINT received. Shutting down...');
    await app.close();
    process.exit(0);
  });

  // Disable console logs in production
  if (process.env.NODE_ENV === 'production') {
    console.log = () => {};
    console.debug = () => {};
    console.warn = () => {};
  }
}

bootstrap();
