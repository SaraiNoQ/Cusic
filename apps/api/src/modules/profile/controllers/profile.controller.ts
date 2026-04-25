import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestWithUser } from '../../auth/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UpdateTagsDto } from '../dto/update-tags.dto';
import { ProfileService } from '../services/profile.service';

@ApiTags('profile')
@ApiBearerAuth()
@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('taste-report')
  @ApiOperation({ summary: 'Get user taste profile report' })
  @ApiResponse({ status: 200, description: 'Taste report' })
  async getTasteReport(@Req() request: RequestWithUser) {
    return {
      success: true,
      data: await this.profileService.getTasteReport(request.user!.id),
      meta: {},
    };
  }

  @Patch('tags')
  @ApiOperation({ summary: 'Patch taste profile tags' })
  @ApiResponse({ status: 200, description: 'Tags updated' })
  async patchTags(
    @Body() body: UpdateTagsDto,
    @Req() request: RequestWithUser,
  ) {
    return {
      success: true,
      data: await this.profileService.updateTags(request.user!.id, body),
      meta: {},
    };
  }
}
