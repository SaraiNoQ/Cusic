import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString } from 'class-validator';

export class CreateImportJobDto {
  @ApiProperty()
  @IsString()
  providerName!: string;

  @ApiProperty({ enum: ['playlist', 'history'] })
  @IsString()
  @IsIn(['playlist', 'history'])
  importType!: 'playlist' | 'history';

  @ApiProperty({ type: Object })
  @IsObject()
  payload!: Record<string, unknown>;
}
