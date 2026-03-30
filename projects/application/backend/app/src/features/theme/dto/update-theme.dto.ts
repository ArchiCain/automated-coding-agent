import { IsEnum } from 'class-validator';

export class UpdateThemeDto {
  @IsEnum(['light', 'dark'], {
    message: 'theme must be either "light" or "dark"',
  })
  theme: 'light' | 'dark';
}
