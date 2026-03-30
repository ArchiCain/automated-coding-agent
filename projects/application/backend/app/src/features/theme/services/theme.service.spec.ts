import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThemeService } from './theme.service';
import { UserTheme } from '../typeorm-database-client/entities';

describe('ThemeService', () => {
  let service: ThemeService;
  let repository: Repository<UserTheme>;

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeService,
        {
          provide: getRepositoryToken(UserTheme),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ThemeService>(ThemeService);
    repository = module.get<Repository<UserTheme>>(
      getRepositoryToken(UserTheme),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTheme', () => {
    it('should return existing theme', async () => {
      const userId = 'test-user-id';
      const mockTheme = { userId, theme: 'dark' as const };
      mockRepository.findOne.mockResolvedValue(mockTheme);

      const result = await service.getTheme(userId);

      expect(result).toEqual({ theme: 'dark', userId });
      expect(repository.findOne).toHaveBeenCalledWith({ where: { userId } });
    });

    it('should create default dark theme if none exists', async () => {
      const userId = 'new-user-id';
      mockRepository.findOne.mockResolvedValue(null);
      const mockCreated = { userId, theme: 'dark' as const };
      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockCreated);

      const result = await service.getTheme(userId);

      expect(result).toEqual({ theme: 'dark', userId });
      expect(repository.create).toHaveBeenCalledWith({
        userId,
        theme: 'dark',
      });
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('updateTheme', () => {
    it('should update existing theme', async () => {
      const userId = 'test-user-id';
      const mockTheme = { userId, theme: 'dark' as 'dark' | 'light' };
      mockRepository.findOne.mockResolvedValue(mockTheme);
      mockRepository.save.mockResolvedValue({ ...mockTheme, theme: 'light' });

      const result = await service.updateTheme(userId, { theme: 'light' });

      expect(result).toEqual({ theme: 'light', userId });
      expect(repository.save).toHaveBeenCalled();
    });

    it('should create theme if none exists', async () => {
      const userId = 'new-user-id';
      mockRepository.findOne.mockResolvedValue(null);
      const mockCreated = { userId, theme: 'light' as const };
      mockRepository.create.mockReturnValue(mockCreated);
      mockRepository.save.mockResolvedValue(mockCreated);

      const result = await service.updateTheme(userId, { theme: 'light' });

      expect(result).toEqual({ theme: 'light', userId });
      expect(repository.create).toHaveBeenCalledWith({
        userId,
        theme: 'light',
      });
    });
  });
});
