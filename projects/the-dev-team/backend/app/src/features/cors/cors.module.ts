import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Module({
  providers: [
    {
      provide: 'CORS_ORIGINS',
      useFactory: (config: ConfigService) => {
        const origins = config.get<string>('CORS_ORIGINS', '*');
        return origins === '*' ? '*' : origins.split(',').map((o) => o.trim());
      },
      inject: [ConfigService],
    },
  ],
  exports: ['CORS_ORIGINS'],
})
export class CorsModule {}
