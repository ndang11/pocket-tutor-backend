import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv, env } from './config/env';

async function bootstrap() {
  // Validate environment variables
  validateEnv();

  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend
  app.enableCors({
    origin: [
      'http://localhost:8081', // Expo dev
      'http://localhost:19006', // Expo web
      'http://localhost:3000',
      'exp://*', // Expo Go
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  await app.listen(env.port);
  console.log(`🚀 Server running on http://localhost:${env.port}`);
}

void bootstrap();
