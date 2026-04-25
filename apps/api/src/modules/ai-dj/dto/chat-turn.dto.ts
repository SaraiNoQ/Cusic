import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ChatSurfaceContextDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  currentTrackId?: string | null;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  queueContentIds?: string[];
}

export class ChatTurnDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty({ enum: ['sync', 'stream'] })
  @IsString()
  @IsIn(['sync', 'stream'])
  responseMode!: 'sync' | 'stream';

  @ApiProperty({ required: false, type: ChatSurfaceContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatSurfaceContextDto)
  surfaceContext?: ChatSurfaceContextDto;
}
