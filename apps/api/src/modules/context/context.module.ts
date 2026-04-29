import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContextService } from './context.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [ContextService],
  exports: [ContextService],
})
export class ContextModule {}
