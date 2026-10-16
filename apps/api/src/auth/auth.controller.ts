import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser, MockLoginResponse } from '@enterprise-hub/shared';
import { AuthService } from './auth.service';
import { AuthUserDto } from './dto/auth-user.dto';
import { MockLoginDto } from './dto/mock-login.dto';
import { MockLoginResponseDto } from './dto/mock-login-response.dto';
import { JwtAuthGuard, JwtAuthUser } from './jwt-auth.guard';

interface AuthenticatedRequest {
  authUser: JwtAuthUser;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('mock-users')
  @ApiOkResponse({ type: AuthUserDto, isArray: true })
  listMockUsers(): Promise<AuthenticatedUser[]> {
    return this.authService.listMockUsers();
  }

  @Post('mock-login')
  @ApiCreatedResponse({ type: MockLoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unknown mock user' })
  login(@Body() { email }: MockLoginDto): Promise<MockLoginResponse> {
    return this.authService.login(email);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired access token' })
  getCurrentUser(@Req() request: AuthenticatedRequest): Promise<AuthenticatedUser> {
    return this.authService.getCurrentUser(request.authUser.sub);
  }
}
