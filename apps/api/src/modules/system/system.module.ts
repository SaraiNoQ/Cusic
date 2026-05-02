import { Module } from '@nestjs/common';
import { ContentModule } from '../content/content.module';
import { LlmModule } from '../llm/llm.module';
import { VoiceModule } from '../voice/voice.module';
import { SystemController } from './system.controller';

@Module({
  imports: [ContentModule, LlmModule, VoiceModule],
  controllers: [SystemController],
})
export class SystemModule {}
