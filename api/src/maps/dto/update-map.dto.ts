import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateMapDto } from './create-map.dto';

export class UpdateMapDto extends PartialType(CreateMapDto) {
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
