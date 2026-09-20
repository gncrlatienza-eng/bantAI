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
import { LoginDto } from './dto/login.dto';
import { PortalRegisterDto } from './dto/portal-register.dto';
import { FirebaseLoginDto } from './dto/firebase-login.dto';

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
  portalRegister(@Body() dto: PortalRegisterDto) {
    return this.authService.registerPortal(dto);
  }

  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Firebase performs SMS delivery and verification. This exchange validates
  // the Firebase ID token and returns the normal bantAI API JWT.
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @Post('mobile/firebase')
  firebaseLogin(@Body() dto: FirebaseLoginDto) {
    return this.authService.firebaseLogin(dto);
  }

  // Authenticated — skip the global throttle, JWT already identifies the user
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: { user: { userId: string } }) {
    return this.authService.getMe(req.user.userId);
  }
}
