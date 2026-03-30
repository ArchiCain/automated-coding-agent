import { Module, Global } from "@nestjs/common";
import { ClaudeCliService } from "./claude-cli.service";

@Global()
@Module({
  providers: [ClaudeCliService],
  exports: [ClaudeCliService],
})
export class ClaudeCliModule {}
