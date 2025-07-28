import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  app.enableCors({
    origin: '*', // or '*' for all origins
    credentials: true,              // if using cookies or Authorization headers
  });
  await app.listen(process.env.PORT ?? 3200);
}
bootstrap();
