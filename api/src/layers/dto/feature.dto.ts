import { IsNotEmpty, IsString, IsUUID, IsOptional, IsIn } from 'class-validator';

export class CreateFeatureDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsIn(['Point', 'LineString', 'Polygon'])
  geomType: string;

  @IsNotEmpty()
  geometry: any;

  @IsOptional()
  properties?: any;
}

export class UpdateFeatureDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsOptional()
  geometry?: any;

  @IsOptional()
  properties?: any;
}
