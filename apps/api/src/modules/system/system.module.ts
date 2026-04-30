import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { VoiceModule } from '../voice/voice.module';
import { SystemController } from './system.controller';

@Module({
  imports: [LlmModule, VoiceModule],
  controllers: [SystemController],
})
export class SystemModule {}
