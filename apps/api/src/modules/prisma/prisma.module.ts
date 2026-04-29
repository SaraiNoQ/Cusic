import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { VectorSearchService } from './vector-search.service';

@Global()
@Module({
  providers: [PrismaService, VectorSearchService],
  exports: [PrismaService, VectorSearchService],
})
export class PrismaModule {}
