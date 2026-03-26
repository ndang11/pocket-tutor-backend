import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateEnv } from './config/env';
import * as express from 'express';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

''
app.enableCors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    
  
    if (!origin || allowed.indexOf(origin) !== -1 || allowed.includes('*')) {
      callback(null, true);
    } else {
      console.error(`[CORS Blocked] Origin: ${origin}`); 
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'apikey', 'Accept', 'Authorization'],
  credentials: true,
});
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');

  console.log(`Server running on port ${port}`);
  console.log(`CORS allowed origins: ${process.env.ALLOWED_ORIGINS || '*'}`);
}

void bootstrap();
