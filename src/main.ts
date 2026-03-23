import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv, env } from './config/env';

async function bootstrap() {
  // Validate environment variables
  validateEnv();

  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: 'GET, HEAD, PUT,PATCH,POST,DELETE,OPTIONS',
    Credential: 'true',
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(
    `CORS:    ${process.env.ALLOWED_ORIGINS}`,
  );
}

void bootstrap();
