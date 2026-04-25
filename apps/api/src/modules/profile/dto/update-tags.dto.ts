import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TasteTagUpdateDto {
  @ApiProperty()
  @IsString()
  type!: string;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiProperty({ enum: ['increase', 'decrease', 'remove'] })
  @IsString()
  @IsIn(['increase', 'decrease', 'remove'])
  action!: 'increase' | 'decrease' | 'remove';
}

export class UpdateTagsDto {
  @ApiProperty({ type: [TasteTagUpdateDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TasteTagUpdateDto)
  updates!: TasteTagUpdateDto[];
}
