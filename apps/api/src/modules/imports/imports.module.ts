import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { JamendoImportProvider } from './providers/jamendo-import.provider';
import { ProviderRegistryService } from './providers/provider-registry.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    JamendoImportProvider,
    ProviderRegistryService,
  ],
  exports: [ProviderRegistryService],
})
export class ImportsModule {}
