import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class QueueItemDto {
  @IsString()
  contentId!: string;
}

export class QueueUpdateDto {
  @IsString()
  @IsIn(['replace', 'append'])
  mode!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueueItemDto)
  items!: QueueItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  activeIndex?: number;

  @IsOptional()
  @IsString()
  currentContentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  positionMs?: number;
}
