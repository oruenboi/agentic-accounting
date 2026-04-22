import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import type { Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import type { AuthenticatedRequest } from './modules/auth/authenticated-request.interface';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    })
  );

  app.use((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const headerRequestId = req.header('x-request-id');
    const requestId = headerRequestId && headerRequestId.trim() !== '' ? headerRequestId : randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
