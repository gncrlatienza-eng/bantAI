import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthAudience } from '../../auth/constants';

/** Blocks mobile sessions from Shield-only masked-message and export paths. */
@Injectable()
export class WebCampaignAudienceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: { audience?: AuthAudience; webRole?: string | null };
    }>();
    if (
      (request.user?.audience === AuthAudience.CLIENT &&
        request.user.webRole === 'SHIELD') ||
      (request.user?.audience === AuthAudience.ADMIN &&
        request.user.webRole === 'ADMIN')
    ) {
      return true;
    }
    throw new ForbiddenException('Web campaign access is required.');
  }
}
