import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';
import {
  RequestClaimEmailOtpDto,
  RequestEmailOtpDto,
  VerifyClaimEmailOtpDto,
  VerifyEmailOtpDto,
} from './dto/email-otp.dto';
import {
  ADMIN_SESSION_COOKIE,
  AuthAudience,
  CLIENT_SESSION_COOKIE,
  LEGACY_PORTAL_SESSION_COOKIE,
} from './constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 5 registration attempts per IP per minute
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('portal/register')
  async portalRegister(
    @Body() dto: PortalRegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.registerPortal(dto);
    this.setSessionCookie(response, result.access_token, AuthAudience.CLIENT);
    return { message: result.message };
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setSessionCookie(response, result.access_token, result.audience);
    return { message: result.message };
  }

  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('client/request-email-otp')
  requestClientEmailOtp(@Body() dto: RequestEmailOtpDto) {
    return this.authService.requestClientEmailOtp(dto);
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('client/verify-email-otp')
  async verifyClientEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyClientEmailOtp(dto);
    this.setSessionCookie(response, result.access_token, AuthAudience.CLIENT);
    return { message: result.message };
  }

  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('client/claim/request-email-otp')
  requestClientClaimEmailOtp(@Body() dto: RequestClaimEmailOtpDto) {
    return this.authService.requestClientClaimEmailOtp(dto);
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('client/claim/verify-email-otp')
  async verifyClientClaimEmailOtp(
    @Body() dto: VerifyClaimEmailOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyClientClaimEmailOtp(dto);
    this.setSessionCookie(response, result.access_token, AuthAudience.CLIENT);
    return { message: result.message };
  }

  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('admin/request-email-otp')
  requestAdminEmailOtp(@Body() dto: RequestEmailOtpDto) {
    return this.authService.requestAdminEmailOtp(dto);
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('admin/verify-email-otp')
  async verifyAdminEmailOtp(
    @Body() dto: VerifyEmailOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyAdminEmailOtp(dto);
    this.setSessionCookie(response, result.access_token, AuthAudience.ADMIN);
    return { message: result.message };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    this.clearWebCookies(response);
  }

  // 5 OTP requests per IP per minute — prevents SMS-flooding abuse
  @Throttle({ global: { ttl: 60_000, limit: 5 } })
  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  // 10 OTP verification attempts per IP per minute
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // Authenticated — skip the global throttle, JWT already identifies the user
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: { user: { userId: string } }) {
    return this.authService.getMe(req.user.userId);
  }

  private setSessionCookie(
    response: Response,
    token: string,
    audience: AuthAudience,
  ) {
    const name =
      audience === AuthAudience.ADMIN
        ? ADMIN_SESSION_COOKIE
        : CLIENT_SESSION_COOKIE;
    const otherName =
      audience === AuthAudience.ADMIN
        ? CLIENT_SESSION_COOKIE
        : ADMIN_SESSION_COOKIE;
    response.clearCookie(otherName, { path: '/api' });
    response.cookie(name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Remove the superseded cookie during the transition.
    response.clearCookie(LEGACY_PORTAL_SESSION_COOKIE, { path: '/api' });
  }

  private clearWebCookies(response: Response) {
    for (const name of [
      CLIENT_SESSION_COOKIE,
      ADMIN_SESSION_COOKIE,
      LEGACY_PORTAL_SESSION_COOKIE,
    ]) {
      response.clearCookie(name, { path: '/api' });
    }
  }
}
