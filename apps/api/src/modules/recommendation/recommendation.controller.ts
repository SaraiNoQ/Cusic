import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsString } from 'class-validator';

class FeedbackDto {
  @IsString()
  targetType!: string;

  @IsString()
  targetId!: string;

  @IsString()
  feedbackType!: string;

  @IsString()
  recommendationResultId!: string;

  @IsString()
  reasonText!: string;
}

@ApiTags('recommendation')
@ApiBearerAuth()
@Controller()
export class RecommendationController {
  @Get('recommend/now')
  @ApiOperation({ summary: 'Get contextual current recommendations' })
  @ApiResponse({ status: 200, description: 'Current recommendation result' })
  getNowRecommendation() {
    return {
      success: true,
      data: {
        recommendationId: 'rec_stub_now',
        explanation:
          'These tracks fit the current focus-heavy session and your recent late-night listening pattern.',
        items: [
          {
            contentId: 'cnt_stub_1',
            title: 'Late Night Drafting',
            reason: 'Warm texture, low interruption, voice-light arrangement.',
          },
        ],
      },
      meta: {},
    };
  }

  @Get('playlist/daily')
  @ApiOperation({ summary: 'Get daily playlist' })
  @ApiResponse({ status: 200, description: 'Daily playlist' })
  getDailyPlaylist() {
    return {
      success: true,
      data: {
        playlistId: 'daily_stub',
        title: 'Today in Cusic',
        items: [],
      },
      meta: {},
    };
  }

  @Post('feedback')
  @ApiOperation({ summary: 'Submit explicit recommendation or content feedback' })
  @ApiResponse({ status: 200, description: 'Feedback recorded' })
  submitFeedback(@Body() body: FeedbackDto) {
    return {
      success: true,
      data: body,
      meta: {},
    };
  }
}

