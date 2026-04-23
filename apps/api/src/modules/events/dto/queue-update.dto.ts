import { Type } from 'class-transformer';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';

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
}
