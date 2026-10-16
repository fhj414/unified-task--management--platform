import { ApiProperty } from '@nestjs/swagger';
import type {
  ComponentStatus,
  HealthResponse,
  ServiceStatuses,
} from '@enterprise-hub/shared';

class HealthServicesDto implements ServiceStatuses {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  api!: ComponentStatus;

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  database!: ComponentStatus;

  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  redis!: ComponentStatus;
}

export class HealthResponseDto implements HealthResponse {
  @ApiProperty({ enum: ['up', 'down'], example: 'up' })
  status!: ComponentStatus;

  @ApiProperty({ example: '2026-10-16T08:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ type: HealthServicesDto })
  services!: ServiceStatuses;
}
