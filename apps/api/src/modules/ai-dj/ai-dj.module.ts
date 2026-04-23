import { Module } from '@nestjs/common';
import { AiDjController } from './ai-dj.controller';

@Module({
  controllers: [AiDjController],
})
export class AiDjModule {}
