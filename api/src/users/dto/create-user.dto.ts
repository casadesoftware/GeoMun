import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['ADMIN', 'EDITOR'])
  @IsOptional()
  role?: 'ADMIN' | 'EDITOR';

  @IsString()
  @IsOptional()
  tenantId?: string;
}