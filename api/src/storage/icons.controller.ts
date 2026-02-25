import { Controller, Get, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('storage/icons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IconsController {
  constructor(private storage: StorageService) {}

  @Post('upload')
  @Roles('ADMIN', 'EDITOR')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file.originalname.endsWith('.svg')) {
      throw new Error('Solo archivos SVG');
    }
    const key = `icons/${Date.now()}-${file.originalname}`;
    await this.storage.upload(key, file.buffer, 'image/svg+xml');
    return { name: file.originalname, key };
  }

  @Get()
  @Roles('ADMIN', 'EDITOR')
  async list() {
    const items = await this.storage.listByPrefix('icons/');
    const bucket = process.env.MINIO_BUCKET || 'geomun';
    return items.map((key) => ({
      name: key.replace('icons/', ''),
      url: `/storage/${bucket}/${key}`,
    }));
  }
}