import { Module } from '@nestjs/common';
import { LayersService } from './layers.service';
import { LayersController } from './layers.controller';

@Module({
  controllers: [LayersController],
  providers: [LayersService],
  exports: [LayersService],
})
export class LayersModule {}
