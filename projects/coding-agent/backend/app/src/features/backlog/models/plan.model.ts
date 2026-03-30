export interface PlanSummary {
  id: string;
  name: string;
  description: string;
  status: string;
  created: string;
  updated: string;
  projectsCount?: number;
  featuresCount?: number;
  tasksCount?: number;
}

export interface PlanListResponse {
  plans: PlanSummary[];
  total: number;
}
