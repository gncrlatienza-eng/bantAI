import { SetMetadata } from '@nestjs/common';
import { ShieldApiScope } from '@prisma/client';
import { SHIELD_SCOPE_KEY } from './shield-api-key.guard';

export const ShieldScope = (scope: ShieldApiScope) =>
  SetMetadata(SHIELD_SCOPE_KEY, scope);
