import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core/services/reflector.service";
import { Request } from "express";
import { REQUIRE_PERMISSION_KEY } from "../decorators/require-permission.decorator";
import { PermissionMetadata, Permission } from "../permissions/permissions.types";
import {
  getPermissionsForRoles,
  hasAllPermissions,
  hasAnyPermission,
} from "../permissions/permissions.constants";
import { KeycloakUserProfile } from "../keycloak-types";

/**
 * Guard that checks if the current user has the required permissions.
 * Works alongside KeycloakJwtGuard - expects the user to already be attached to the request.
 *
 * @example
 * // Use with RequirePermission decorator
 * @UseGuards(KeycloakJwtGuard, PermissionGuard)
 * @RequirePermission('users:read')
 * async getUsers() { ... }
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Get permission metadata from the handler or class
    const permissionMetadata =
      this.reflector.getAllAndOverride<PermissionMetadata>(
        REQUIRE_PERMISSION_KEY,
        [context.getHandler(), context.getClass()]
      );

    // If no permission metadata is set, allow access (no permission required)
    if (!permissionMetadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request["user"] as KeycloakUserProfile | undefined;

    // If no user is attached to the request, deny access
    if (!user) {
      this.logger.warn(
        "PermissionGuard: No user found on request. Ensure KeycloakJwtGuard runs before PermissionGuard."
      );
      throw new ForbiddenException("User not authenticated");
    }

    // Get user's roles and map them to permissions
    const userRoles = user.roles || [];
    const userPermissions = getPermissionsForRoles(userRoles);

    // Check if user has the required permissions
    const { permissions: requiredPermissions, options } = permissionMetadata;
    const hasRequiredPermissions = this.checkPermissions(
      userPermissions,
      requiredPermissions,
      options.requireAll ?? false
    );

    if (!hasRequiredPermissions) {
      this.logger.warn(
        `Permission denied for user ${user.username}. Required: [${requiredPermissions.join(", ")}], Has: [${userPermissions.join(", ")}]`
      );
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }

  /**
   * Check if user has the required permissions based on the requireAll option
   */
  private checkPermissions(
    userPermissions: Permission[],
    requiredPermissions: Permission[],
    requireAll: boolean
  ): boolean {
    if (requireAll) {
      return hasAllPermissions(userPermissions, requiredPermissions);
    }
    return hasAnyPermission(userPermissions, requiredPermissions);
  }
}
