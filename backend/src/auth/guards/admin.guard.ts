import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      user?: { role?: string };
    }>();
    if (req.user?.role !== 'ADMIN') {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}
