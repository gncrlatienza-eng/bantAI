import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpSmsService } from './otp-sms.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { jwtConstants } from './constants';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: {
        // jsonwebtoken's SignOptions.expiresIn expects its own branded
        // StringValue type (from the `ms` package), which a plain env-var
        // string can't satisfy without this cast.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OtpSmsService, JwtStrategy],
  exports: [JwtModule],
})
export class AuthModule {}
