import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SaveAiPlaylistDto {
  @ApiProperty()
  @IsString()
  sessionId!: string;

  @ApiProperty()
  @IsString()
  messageId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;
}
