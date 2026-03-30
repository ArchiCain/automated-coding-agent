import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ThemeService } from '../services/theme.service';
import { UpdateThemeDto, GetThemeResponseDto } from '../dto';
import { KeycloakJwtGuard } from '../../keycloak-auth/guards/keycloak-jwt.guard';
import { KeycloakUser } from '../../keycloak-auth/decorators/keycloak-user.decorator';

@ApiTags('theme')
@ApiBearerAuth()
@Controller('theme')
@UseGuards(KeycloakJwtGuard)
export class ThemeController {
  private readonly logger = new Logger(ThemeController.name);

  constructor(private readonly themeService: ThemeService) {}

  @Get()
  @ApiOperation({ summary: 'Get user theme preference' })
  @ApiResponse({
    status: 200,
    description: 'Theme preference retrieved successfully',
    type: GetThemeResponseDto,
  })
  async getTheme(@KeycloakUser('id') userId: string): Promise<GetThemeResponseDto> {
    this.logger.log(`GET /theme - userId: ${userId}`);
    return this.themeService.getTheme(userId);
  }

  @Put()
  @ApiOperation({ summary: 'Update user theme preference' })
  @ApiResponse({
    status: 200,
    description: 'Theme preference updated successfully',
    type: GetThemeResponseDto,
  })
  async updateTheme(
    @KeycloakUser('id') userId: string,
    @Body() updateThemeDto: UpdateThemeDto,
  ): Promise<GetThemeResponseDto> {
    this.logger.log(`PUT /theme - userId: ${userId}, theme: ${updateThemeDto.theme}`);
    return this.themeService.updateTheme(userId, updateThemeDto);
  }
}
