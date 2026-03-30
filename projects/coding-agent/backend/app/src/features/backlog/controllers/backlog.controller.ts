import { Controller, Get } from "@nestjs/common";
import { BacklogService } from "../services/backlog.service";
import { PlanSummary } from "../models/plan.model";

export interface BacklogResponse {
  plans: PlanSummary[];
  total: number;
}

@Controller("api/backlog")
export class BacklogController {
  constructor(private readonly backlogService: BacklogService) {}

  @Get()
  async getPlans(): Promise<BacklogResponse> {
    return this.backlogService.getPlans();
  }
}
