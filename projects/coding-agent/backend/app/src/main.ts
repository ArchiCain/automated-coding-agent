import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for local development
  app.enableCors({
    origin: "*",
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Accept", "Authorization", "Content-Type", "X-Requested-With"],
  });

  const port = process.env.PORT || 8086;
  await app.listen(port);
  console.log(`Coding Agent Backend is running on: http://localhost:${port}`);
}
bootstrap();
