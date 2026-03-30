import { Module } from "@nestjs/common";
import { BacklogController } from "./controllers/backlog.controller";
import { BacklogService } from "./services/backlog.service";

@Module({
  controllers: [BacklogController],
  providers: [BacklogService],
  exports: [BacklogService],
})
export class BacklogModule {}
