import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { ProviderRegistryService } from './provider-registry.service';

@Module({
  imports: [ConfigModule],
  providers: [ProviderRegistryService],
  exports: [ProviderRegistryService],
})
export class ProviderModule {}
