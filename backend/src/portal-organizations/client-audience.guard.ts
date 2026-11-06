import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AuthAudience } from '../auth/constants';

@Injectable()
export class ClientAudienceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { audience?: AuthAudience };
    }>();
    if (request.user?.audience !== AuthAudience.CLIENT) {
      throw new ForbiddenException('Shield portal access is required.');
    }
    return true;
  }
}
