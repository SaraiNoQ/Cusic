import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestWithUser } from '../../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/guards/optional-jwt-auth.guard';
import { FeedbackDto } from '../dto/feedback.dto';
import { RecommendationService } from '../services/recommendation.service';

@ApiTags('recommendation')
@ApiBearerAuth()
@Controller()
export class RecommendationController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Get('recommend/now')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: 'X-Cusic-Timezone', required: false })
  @ApiOperation({ summary: 'Get contextual current recommendations' })
  @ApiResponse({ status: 200, description: 'Current recommendation result' })
  async getNowRecommendation(
    @Req() request: RequestWithUser,
    @Headers('x-cusic-timezone') timezone?: string,
  ) {
    return {
      success: true,
      data: await this.recommendationService.getNowRecommendation(
        request.user?.id,
        timezone,
      ),
      meta: {},
    };
  }

  @Get('playlist/daily')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiHeader({ name: 'X-Cusic-Timezone', required: false })
  @ApiOperation({ summary: 'Get daily playlist' })
  @ApiResponse({ status: 200, description: 'Daily playlist' })
  async getDailyPlaylist(
    @Req() request: RequestWithUser,
    @Headers('x-cusic-timezone') timezone?: string,
  ) {
    return {
      success: true,
      data: await this.recommendationService.getDailyPlaylist(
        request.user?.id,
        timezone,
      ),
      meta: {},
    };
  }

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Submit explicit recommendation or content feedback',
  })
  @ApiResponse({ status: 200, description: 'Feedback recorded' })
  async submitFeedback(
    @Body() body: FeedbackDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.recommendationService.submitFeedback(
        request.user!.id,
        body,
      ),
      meta: {},
    };
  }
}
