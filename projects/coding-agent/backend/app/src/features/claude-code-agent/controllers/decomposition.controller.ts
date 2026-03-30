import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  DecompositionService,
  DecompositionSession,
  PlanInfo,
  TaskInfo,
  ExistingTask,
  ProjectTaskItem,
  FeatureTaskItem,
  ConcernTaskItem,
  TaskStatusFile,
  TaskStatus,
  ResetResult,
} from '../services/decomposition.service';

interface CreateSessionDto {
  planId: string;
  decompType: string;
}

interface CreateTaskSessionDto {
  taskId: string;
  decompType: string;
}

interface UpdateReadyDto {
  ready: boolean;
}

interface UpdateTaskStatusDto {
  status: TaskStatus;
}

@Controller('api/decomposition')
export class DecompositionController {
  constructor(private readonly decompositionService: DecompositionService) {}

  /**
   * Get all plans available for decomposition
   */
  @Get('plans')
  async listPlans(): Promise<{ plans: PlanInfo[] }> {
    const plans = await this.decompositionService.listPlans();
    return { plans };
  }

  /**
   * Get a specific plan's info
   */
  @Get('plans/:planId')
  async getPlan(@Param('planId') planId: string): Promise<{ plan: PlanInfo }> {
    const plan = await this.decompositionService.getPlanInfo(planId);
    if (!plan) {
      throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
    }
    return { plan };
  }

  /**
   * Update a plan's ready status
   */
  @Patch('plans/:planId/ready')
  async updatePlanReady(
    @Param('planId') planId: string,
    @Body() dto: UpdateReadyDto,
  ): Promise<{ success: boolean }> {
    await this.decompositionService.updatePlanReady(planId, dto.ready);
    return { success: true };
  }

  /**
   * Update a task's ready status
   */
  @Patch('plans/:planId/tasks/:taskSlug/ready')
  async updateTaskReady(
    @Param('planId') planId: string,
    @Param('taskSlug') taskSlug: string,
    @Body() dto: UpdateReadyDto,
  ): Promise<{ success: boolean }> {
    await this.decompositionService.updateTaskReady(planId, taskSlug, dto.ready);
    return { success: true };
  }

  /**
   * Get tasks tree for a plan
   */
  @Get('plans/:planId/tasks')
  async getTasksTree(@Param('planId') planId: string): Promise<{ tasks: any[] }> {
    const tasks = await this.decompositionService.getTasksTree(planId);
    return { tasks };
  }

  /**
   * Get tasks from a specific directory (outputBase)
   */
  @Post('tasks-from-directory')
  async getTasksFromDirectory(
    @Body() dto: { directory: string },
  ): Promise<{ tasks: any[] }> {
    if (!dto.directory) {
      throw new HttpException('Directory is required', HttpStatus.BAD_REQUEST);
    }
    const tasks = await this.decompositionService.getTasksFromDirectory(dto.directory);
    return { tasks };
  }

  /**
   * Get existing tasks for a plan (for prompt injection)
   */
  @Get('plans/:planId/existing-tasks')
  async getExistingTasks(@Param('planId') planId: string): Promise<{ tasks: ExistingTask[] }> {
    const tasks = await this.decompositionService.getExistingTasks(planId);
    return { tasks };
  }

  /**
   * Get available decomposition types
   */
  @Get('types')
  getDecompTypes(): {
    types: Array<{ id: string; name: string; description: string }>;
  } {
    return {
      types: this.decompositionService.getDecompTypes(),
    };
  }

  /**
   * List all project-level tasks (for Project to Features page)
   */
  @Get('project-tasks')
  async listProjectTasks(): Promise<{ tasks: TaskInfo[] }> {
    const tasks = await this.decompositionService.listProjectTasks();
    return { tasks };
  }

  /**
   * List all feature-level tasks (for Feature to Concerns page)
   */
  @Get('feature-tasks')
  async listFeatureTasks(): Promise<{ tasks: TaskInfo[] }> {
    const tasks = await this.decompositionService.listFeatureTasks();
    return { tasks };
  }

  /**
   * Create a new decomposition session (ephemeral, in-memory)
   */
  @Post('sessions')
  async createSession(
    @Body() dto: CreateSessionDto,
  ): Promise<{ session: DecompositionSession }> {
    if (!dto.planId) {
      throw new HttpException('Plan ID is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.decompType) {
      throw new HttpException(
        'Decomposition type is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.decompositionService.createSession(
      dto.planId,
      dto.decompType,
    );
    return { session };
  }

  /**
   * Create a decomposition session for a task (project or feature)
   */
  @Post('task-sessions')
  async createTaskSession(
    @Body() dto: CreateTaskSessionDto,
  ): Promise<{ session: DecompositionSession }> {
    if (!dto.taskId) {
      throw new HttpException('Task ID is required', HttpStatus.BAD_REQUEST);
    }
    if (!dto.decompType) {
      throw new HttpException(
        'Decomposition type is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const session = await this.decompositionService.createSessionForTask(
      dto.taskId,
      dto.decompType,
    );
    return { session };
  }

  /**
   * Get a specific decomposition session (in-memory only)
   */
  @Get('sessions/:sessionId')
  getSession(
    @Param('sessionId') sessionId: string,
  ): { session: DecompositionSession | null } {
    const session = this.decompositionService.getSession(sessionId);
    if (!session) {
      throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
    }
    return { session };
  }

  // ============================================
  // Task CRUD endpoints (for decomposition pages)
  // ============================================

  /**
   * Get project tasks for a specific plan
   */
  @Get('plans/:planId/project-tasks')
  async getProjectTasksForPlan(
    @Param('planId') planId: string,
  ): Promise<{ projects: ProjectTaskItem[] }> {
    const projects = await this.decompositionService.getProjectTasksForPlan(planId);
    return { projects };
  }

  /**
   * Get feature tasks for a specific project within a plan
   */
  @Get('plans/:planId/projects/:projectPath/features')
  async getFeatureTasksForProject(
    @Param('planId') planId: string,
    @Param('projectPath') projectPath: string,
  ): Promise<{ features: FeatureTaskItem[] }> {
    const decodedPath = decodeURIComponent(projectPath);
    const features = await this.decompositionService.getFeatureTasksForProject(planId, decodedPath);
    return { features };
  }

  /**
   * Get concern tasks for a specific feature within a project
   */
  @Get('plans/:planId/projects/:projectPath/features/:featureName/concerns')
  async getConcernTasksForFeature(
    @Param('planId') planId: string,
    @Param('projectPath') projectPath: string,
    @Param('featureName') featureName: string,
  ): Promise<{ concerns: ConcernTaskItem[] }> {
    const decodedPath = decodeURIComponent(projectPath);
    const concerns = await this.decompositionService.getConcernTasksForFeature(
      planId,
      decodedPath,
      featureName,
    );
    return { concerns };
  }

  /**
   * Update a task's status
   */
  @Put('plans/:planId/task-status/*taskPath')
  async updateTaskStatus(
    @Param('planId') planId: string,
    @Param('taskPath') taskPath: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<TaskStatusFile> {
    const decodedPath = decodeURIComponent(taskPath);
    return this.decompositionService.updateTaskStatusByPath(planId, decodedPath, dto.status);
  }

  /**
   * Reset project decomposition (delete all features under a project)
   */
  @Delete('plans/:planId/projects/:projectPath/features')
  async resetProjectDecomposition(
    @Param('planId') planId: string,
    @Param('projectPath') projectPath: string,
  ): Promise<ResetResult> {
    const decodedPath = decodeURIComponent(projectPath);
    return this.decompositionService.resetProjectDecomposition(planId, decodedPath);
  }

  /**
   * Reset feature decomposition (delete all concerns under a feature)
   */
  @Delete('plans/:planId/projects/:projectPath/features/:featureName/concerns')
  async resetFeatureDecomposition(
    @Param('planId') planId: string,
    @Param('projectPath') projectPath: string,
    @Param('featureName') featureName: string,
  ): Promise<ResetResult> {
    const decodedPath = decodeURIComponent(projectPath);
    return this.decompositionService.resetFeatureDecomposition(planId, decodedPath, featureName);
  }
}
