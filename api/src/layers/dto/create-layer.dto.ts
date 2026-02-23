import { IsNotEmpty, IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateLayerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  mapId: string;

  @IsOptional()
  style?: any;

  @IsOptional()
  fields?: any;
}
