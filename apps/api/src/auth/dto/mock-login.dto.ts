import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class MockLoginDto {
  @ApiProperty({ example: 'ada.lovelace@enterprise-hub.local' })
  @IsEmail()
  email!: string;
}
