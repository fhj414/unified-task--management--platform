import { ApiProperty } from '@nestjs/swagger';
import type { AuthenticatedUser, DepartmentSummary } from '@enterprise-hub/shared';

export class DepartmentSummaryDto implements DepartmentSummary {
  @ApiProperty({ example: 'engineering-id' })
  id!: string;

  @ApiProperty({ example: 'Engineering' })
  name!: string;
}

export class AuthUserDto implements AuthenticatedUser {
  @ApiProperty({ example: 'user-id' })
  id!: string;

  @ApiProperty({ example: 'ada.lovelace@enterprise-hub.local' })
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name!: string;

  @ApiProperty({ type: () => DepartmentSummaryDto, nullable: true })
  department!: DepartmentSummaryDto | null;
}
