import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { KeycloakUserProfile } from '../keycloak-types';

export const KeycloakUser = createParamDecorator(
  (data: keyof KeycloakUserProfile | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as KeycloakUserProfile;

    return data ? user?.[data] : user;
  },
);