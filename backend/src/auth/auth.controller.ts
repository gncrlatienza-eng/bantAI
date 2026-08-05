import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RegisterDto } from './dto/register.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

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
}
