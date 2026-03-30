import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import { KeycloakAuthService } from "../services/keycloak-auth.service";
import { Reflector } from "@nestjs/core/services/reflector.service";

@Injectable()
export class KeycloakJwtGuard implements CanActivate {
  private readonly logger = new Logger(KeycloakJwtGuard.name);

  constructor(
    private keycloakAuthService: KeycloakAuthService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>("isPublic", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true; // skip guard for public routes

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromRequest(request);
    if (!token) {
      throw new UnauthorizedException("No token provided");
    }

    try {
      const user = await this.keycloakAuthService.validateToken(token);
      request["user"] = user;
      return true;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractTokenFromRequest(request: Request): string | null {
    // Check for token in cookies first
    if (request.cookies && request.cookies.access_token) {
      return request.cookies.access_token;
    }

    // Then check for token in Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.split(" ")[0] === "Bearer") {
      return authHeader.split(" ")[1];
    }

    return null;
  }
}
