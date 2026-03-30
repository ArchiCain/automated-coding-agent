import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getCorsConfigFromEnv } from "./features/cors";
import * as cookieParser from "cookie-parser";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Configure CORS using the CORS package
  const corsConfig = getCorsConfigFromEnv();
  app.enableCors(corsConfig);

  const port = process.env.PORT;
  await app.listen(port);
  console.log(`Backend Service is running on: http://localhost:${port}`);
}
bootstrap();
