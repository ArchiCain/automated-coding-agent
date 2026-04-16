import { Module } from '@nestjs/common';
import { AgentModule } from '../agent';
import { RouterService } from './router.service';

@Module({
  imports: [AgentModule],
  providers: [RouterService],
})
export class RouterModule {}
