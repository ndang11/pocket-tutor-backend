import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';
import * as express from 'express';

async function bootstrap() {
  // 1. Validate environment variables before doing anything
  validateEnv();

  // 2. Silence the annoying PDF warnings globally
  const originalWarn = console.warn;
  console.warn = (...args) => {
    const message = args[0]?.toString() || '';
    if (
      message.includes('Setting up fake worker') ||
      message.includes('Unsupported: field.type') ||
      message.includes('NOT valid form element')
    ) {
      return; // Ignore these specific warnings
    }
    originalWarn(...args);
  };

  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use((req, res, next) => {
    console.log(`[INCOMING] ${req.method} ${req.path} from ${req.ip}`);
    next();
  });

  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'apikey', 'Accept', 'Authorization'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Pocket Tutor Backend running on: http://localhost:${port}`);
}

void bootstrap();
