import { IsNumber, IsOptional, IsString } from 'class-validator';

export class PlaybackEventDto {
  @IsString()
  contentId!: string;

  @IsString()
  eventType!: string;

  @IsOptional()
  @IsNumber()
  positionMs?: number;

  @IsString()
  occurredAt!: string;
}
