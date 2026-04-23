import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('system')
@Controller('system')
export class SystemController {
  @Get('health')
  @ApiOperation({ summary: 'API health check' })
  @ApiResponse({ status: 200, description: 'System is healthy' })
  getHealth() {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'api',
        version: '0.1.0',
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
