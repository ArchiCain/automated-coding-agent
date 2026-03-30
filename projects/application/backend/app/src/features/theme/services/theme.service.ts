import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTheme } from '../../typeorm-database-client/entities';
import { UpdateThemeDto, GetThemeResponseDto } from '../dto';

@Injectable()
export class ThemeService {
  private readonly logger = new Logger(ThemeService.name);

  constructor(
    @InjectRepository(UserTheme)
    private readonly userThemeRepository: Repository<UserTheme>,
  ) {}

  async getTheme(userId: string): Promise<GetThemeResponseDto> {
    this.logger.log(`Getting theme for user: ${userId}`);

    let userTheme = await this.userThemeRepository.findOne({
      where: { userId },
    });

    if (!userTheme) {
      this.logger.log(`No theme found for user ${userId}, creating default`);
      userTheme = this.userThemeRepository.create({
        userId,
        theme: 'dark',
      });
      await this.userThemeRepository.save(userTheme);
    }

    return {
      theme: userTheme.theme,
      userId: userTheme.userId,
    };
  }

  async updateTheme(
    userId: string,
    updateThemeDto: UpdateThemeDto,
  ): Promise<GetThemeResponseDto> {
    this.logger.log(
      `Updating theme for user ${userId} to: ${updateThemeDto.theme}`,
    );

    let userTheme = await this.userThemeRepository.findOne({
      where: { userId },
    });

    if (!userTheme) {
      userTheme = this.userThemeRepository.create({
        userId,
        theme: updateThemeDto.theme,
      });
    } else {
      userTheme.theme = updateThemeDto.theme;
    }

    await this.userThemeRepository.save(userTheme);

    return {
      theme: userTheme.theme,
      userId: userTheme.userId,
    };
  }
}
