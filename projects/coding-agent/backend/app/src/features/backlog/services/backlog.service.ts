import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";
import { PlanSummary } from "../models/plan.model";

export interface BacklogResponse {
  plans: PlanSummary[];
  total: number;
}

@Injectable()
export class BacklogService {
  private readonly logger = new Logger(BacklogService.name);
  private readonly backlogPath: string;

  constructor() {
    // Navigate from app/dist/features/backlog/services to repo root/.coding-agent-data/backlog
    // 8 levels up: services -> backlog -> features -> dist -> app -> backend -> coding-agent -> projects -> repo-root
    this.backlogPath = path.resolve(
      __dirname,
      "../../../../../../../../.coding-agent-data/backlog"
    );
  }

  async getPlans(): Promise<BacklogResponse> {
    const plans: PlanSummary[] = [];

    try {
      const entries = await fs.readdir(this.backlogPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("p-")) {
          const planDir = path.join(this.backlogPath, entry.name);
          const plan = await this.readPlanSummary(planDir, entry.name);
          if (plan) {
            plans.push(plan);
          }
        }
      }

      // Sort by updated date, newest first
      plans.sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime()
      );

      return { plans, total: plans.length };
    } catch (error) {
      this.logger.error(`Failed to list plans: ${error.message}`);
      return { plans: [], total: 0 };
    }
  }

  private async readPlanSummary(
    planDir: string,
    planId: string
  ): Promise<PlanSummary | null> {
    try {
      const statePath = path.join(planDir, "state.json");

      // Read state.json - all metadata should be here
      const stateContent = await fs.readFile(statePath, "utf-8");
      const stateData = JSON.parse(stateContent);

      return {
        id: planId,
        name: stateData.name || planId,
        description: stateData.description || "",
        status: stateData.status || "unknown",
        created: stateData.created || "",
        updated: stateData.updated || "",
        projectsCount: stateData.projectsCount,
        featuresCount: stateData.featuresCount,
        tasksCount: stateData.tasksCount,
      };
    } catch (error) {
      this.logger.warn(`Failed to read plan ${planId}: ${error.message}`);
      return null;
    }
  }
}
