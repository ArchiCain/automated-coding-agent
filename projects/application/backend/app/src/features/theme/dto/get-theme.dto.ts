import { IsEnum } from 'class-validator';

export class GetThemeResponseDto {
  @IsEnum(['light', 'dark'])
  theme: 'light' | 'dark';

  userId: string;
}
