import { Module, Global } from "@nestjs/common";
import { CorsService } from "./cors.service";

@Global()
@Module({
  providers: [CorsService],
  exports: [CorsService],
})
export class CorsModule {}
