import {
  Controller,
  Get,
} from '@nestjs/common';

@Controller('mastra-agents')
export class MastraAgentsController {
  /**
   * This is kept in the backend for future use (e.g., landing page)
   * @returns
   */
  @Get('startup-message')
  getStartupMessage() {
    return {
      text: 'Hello! I\'m your general Conversational AI. How can I help you today?',
    };
  }
}
