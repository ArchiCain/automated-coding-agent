import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { PromptsService, PromptInfo } from '../services/prompts.service';

@Controller('api/prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get()
  async list(): Promise<{ prompts: PromptInfo[] }> {
    const prompts = await this.promptsService.listPrompts();
    return { prompts };
  }

  @Get(':filename')
  async read(@Param('filename') filename: string): Promise<{ content: string }> {
    const content = await this.promptsService.readPrompt(filename);
    return { content };
  }

  @Post()
  async create(@Body() body: { filename: string; content: string }): Promise<{ success: boolean }> {
    await this.promptsService.createPrompt(body.filename, body.content);
    return { success: true };
  }

  @Put(':filename')
  async update(
    @Param('filename') filename: string,
    @Body() body: { content: string },
  ): Promise<{ success: boolean }> {
    await this.promptsService.updatePrompt(filename, body.content);
    return { success: true };
  }

  @Delete(':filename')
  async delete(@Param('filename') filename: string): Promise<{ success: boolean }> {
    await this.promptsService.deletePrompt(filename);
    return { success: true };
  }
}
