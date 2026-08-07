import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';

/**
 * M8B — Format & Validasi (BRD §7.2). Imported as `ConfigModule` in AppModule.
 */
@Module({
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}