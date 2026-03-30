import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';
import { KeycloakJwtGuard } from '../keycloak-auth/guards/keycloak-jwt.guard';

describe('ThemeController', () => {
  let controller: ThemeController;
  let service: ThemeService;

  const mockThemeService = {
    getTheme: jest.fn(),
    updateTheme: jest.fn(),
  };

  const mockGuard = {
    canActivate: (context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest();
      request.user = { id: 'test-user' };
      return true;
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ThemeController],
      providers: [
        {
          provide: ThemeService,
          useValue: mockThemeService,
        },
      ],
    })
      .overrideGuard(KeycloakJwtGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<ThemeController>(ThemeController);
    service = module.get<ThemeService>(ThemeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTheme', () => {
    it('should call service.getTheme with userId', async () => {
      const userId = 'test-user';
      const mockResponse = { theme: 'dark' as const, userId };
      mockThemeService.getTheme.mockResolvedValue(mockResponse);

      const result = await controller.getTheme(userId);

      expect(result).toEqual(mockResponse);
      expect(service.getTheme).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateTheme', () => {
    it('should call service.updateTheme with userId and dto', async () => {
      const userId = 'test-user';
      const dto = { theme: 'light' as const };
      const mockResponse = { theme: 'light' as const, userId };
      mockThemeService.updateTheme.mockResolvedValue(mockResponse);

      const result = await controller.updateTheme(userId, dto);

      expect(result).toEqual(mockResponse);
      expect(service.updateTheme).toHaveBeenCalledWith(userId, dto);
    });
  });
});
