import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { IconsController } from './icons.controller';

@Global()
@Module({
  controllers: [IconsController],
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
