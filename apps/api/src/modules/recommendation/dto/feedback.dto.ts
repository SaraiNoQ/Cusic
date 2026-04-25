import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class FeedbackDto {
  @ApiProperty()
  @IsString()
  targetType!: string;

  @ApiProperty()
  @IsString()
  targetId!: string;

  @ApiProperty({
    enum: ['like', 'dislike', 'more_like_this', 'less_like_this'],
  })
  @IsString()
  @IsIn(['like', 'dislike', 'more_like_this', 'less_like_this'])
  feedbackType!: 'like' | 'dislike' | 'more_like_this' | 'less_like_this';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recommendationResultId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  reasonText?: string;
}
