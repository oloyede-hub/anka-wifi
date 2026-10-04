import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/validation';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();
  app.useGlobalPipes(createValidationPipe());
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
