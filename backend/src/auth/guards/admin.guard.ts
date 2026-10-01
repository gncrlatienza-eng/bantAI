import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthAudience } from '../constants';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { webRole?: string | null; audience?: AuthAudience };
    }>();
    if (
      req.user?.webRole !== 'ADMIN' ||
      req.user.audience !== AuthAudience.ADMIN
    ) {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}
