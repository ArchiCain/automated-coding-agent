import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jose from 'jose';
import { LoginDto, JwtTokens, TokenPayload, KeycloakUserProfile } from '../keycloak-types';

@Injectable()
export class KeycloakAuthService {
  private readonly logger = new Logger(KeycloakAuthService.name);
  private readonly keycloakBaseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private configService: ConfigService) {
    this.keycloakBaseUrl = this.configService.get<string>('KEYCLOAK_BASE_URL') || 'http://keycloak:8080';
    this.realm = this.configService.get<string>('KEYCLOAK_REALM') || 'application';
    this.clientId = this.configService.get<string>('KEYCLOAK_CLIENT_ID') || 'backend-service';
    this.clientSecret = this.configService.get<string>('KEYCLOAK_CLIENT_SECRET') || 'backend-service-secret';
  }

  async login(loginDto: LoginDto): Promise<JwtTokens> {
    const { username, password } = loginDto;

    const formData = new URLSearchParams();
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);
    formData.append('grant_type', 'password');
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Authentication failed: ${error}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      this.logger.error(`Login error: ${error.message}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async refreshToken(refreshToken: string): Promise<JwtTokens> {
    const formData = new URLSearchParams();
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);
    formData.append('grant_type', 'refresh_token');
    formData.append('refresh_token', refreshToken);

    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        },
      );

      if (!response.ok) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokenData = await response.json();

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
      };
    } catch (error) {
      this.logger.error(`Token refresh error: ${error.message}`);
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const formData = new URLSearchParams();
    formData.append('client_id', this.clientId);
    formData.append('client_secret', this.clientSecret);
    formData.append('refresh_token', refreshToken);

    try {
      const response = await fetch(
        `${this.keycloakBaseUrl}/realms/${this.realm}/protocol/openid-connect/logout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        },
      );

      if (!response.ok) {
        this.logger.warn(`Logout request failed: ${await response.text()}`);
      }
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`);
    }
  }

  async validateToken(token: string): Promise<KeycloakUserProfile> {
    try {
      const payload = await this.decodeToken(token);

      return {
        id: payload.sub,
        username: payload.preferred_username,
        email: payload.email || '',
        firstName: payload.given_name,
        lastName: payload.family_name,
        roles: [
          ...(payload.realm_access?.roles || []),
          ...this.getClientRoles(payload),
        ],
      };
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getClientRoles(payload: TokenPayload): string[] {
    const clientRoles: string[] = [];

    if (payload.resource_access && payload.resource_access[this.clientId]) {
      clientRoles.push(...payload.resource_access[this.clientId].roles);
    }

    return clientRoles;
  }

  private async decodeToken(token: string): Promise<TokenPayload> {
    try {
      // Simple validation - in production, you should verify signature with JWKS
      const decodedToken = jose.decodeJwt(token) as TokenPayload;

      if (decodedToken.exp * 1000 < Date.now()) {
        throw new Error('Token expired');
      }

      return decodedToken;
    } catch (error) {
      this.logger.error(`Token decode error: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }
}