import { Module, Global } from "@nestjs/common";
import { CorsService } from "./services/cors.service";

@Global()
@Module({
  providers: [CorsService],
  exports: [CorsService],
})
export class CorsModule {}
