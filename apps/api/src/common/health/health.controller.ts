import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import type { HealthResponse } from '@enterprise-hub/shared';
import { HealthResponseDto } from './health-response.dto';
import { HealthService } from './health.service';

interface StatusResponse {
  status(statusCode: number): unknown;
}

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check API and dependency health' })
  @ApiOkResponse({
    description: 'The API and its dependencies are healthy.',
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more dependencies are unavailable.',
    type: HealthResponseDto,
  })
  async check(
    @Res({ passthrough: true }) response: StatusResponse,
  ): Promise<HealthResponse> {
    const result = await this.healthService.check();

    response.status(
      result.status === 'up'
        ? HttpStatus.OK
        : HttpStatus.SERVICE_UNAVAILABLE,
    );

    return result;
  }
}
