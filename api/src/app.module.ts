import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MapsModule } from './maps/maps.module';
import { LayersModule } from './layers/layers.module';
import { AuditModule } from './audit/audit.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    MapsModule,
    LayersModule,
    AuditModule,
    StorageModule,
  ],
})
export class AppModule {}
