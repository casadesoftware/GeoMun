import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateMapDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  theme?: string;

  @IsOptional()
  config?: any;
}
