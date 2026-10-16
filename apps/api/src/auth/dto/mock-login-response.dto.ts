import { ApiProperty } from '@nestjs/swagger';
import type { MockLoginResponse } from '@enterprise-hub/shared';
import { AuthUserDto } from './auth-user.dto';

export class MockLoginResponseDto implements MockLoginResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' })
  accessToken!: string;

  @ApiProperty({ type: () => AuthUserDto })
  user!: AuthUserDto;
}
