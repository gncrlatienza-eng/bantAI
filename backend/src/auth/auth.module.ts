import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../../database/prisma.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifierService } from './firebase-token-verifier.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AdminGuard } from './guards/admin.guard';
import { jwtConstants } from './constants';

/*
 * @Global(): every feature controller uses JwtAuthGuard (which extends
 * @nestjs/passport AuthGuard('jwt')) and depends on AuthModuleOptions +
 * JwtStrategy. Without global scope, every module would need to import
 * AuthModule OR PassportModule + JwtModule locally, and the DI resolution
 * would still be order-sensitive (AiModule failed before AuthModule loaded).
 * Marking auth global lets every controller pull the guard from any position
 * in the module graph.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
  providers: [
    AuthService,
    FirebaseTokenVerifierService,
    JwtStrategy,
    AdminGuard,
  ],
  exports: [JwtModule, PassportModule, AdminGuard],
})
export class AuthModule {}
