/**
 * Unit test for KeycloakAuthService
 * Tests authentication logic with mocked HTTP calls
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { KeycloakAuthService } from './keycloak-auth.service';

// Mock global fetch
global.fetch = jest.fn();

describe('KeycloakAuthService (Unit)', () => {
  let service: KeycloakAuthService;
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();

    // Create mock config service
    mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          KEYCLOAK_BASE_URL: 'http://keycloak:8080',
          KEYCLOAK_REALM: 'test-realm',
          KEYCLOAK_CLIENT_ID: 'test-client',
          KEYCLOAK_CLIENT_SECRET: 'test-secret',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeycloakAuthService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<KeycloakAuthService>(KeycloakAuthService);
  });

  describe('login', () => {
    it('should return JWT tokens on successful login', async () => {
      // Arrange
      const mockTokenResponse = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expires_in: 300,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      // Act
      const result = await service.login({ username: 'testuser', password: 'testpass' });

      // Assert
      expect(result).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 300,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/protocol/openid-connect/token'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should throw UnauthorizedException on failed login', async () => {
      // Arrange
      console.log('→ Testing error state: Keycloak login failure');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Invalid credentials'),
      });

      // Act & Assert
      await expect(
        service.login({ username: 'wrong', password: 'wrong' })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on network error', async () => {
      // Arrange
      console.log('→ Testing error state: Network error during login');
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        service.login({ username: 'test', password: 'test' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return new JWT tokens on successful refresh', async () => {
      // Arrange
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 300,
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse),
      });

      // Act
      const result = await service.refreshToken('old-refresh-token');

      // Assert
      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 300,
      });
    });

    it('should throw UnauthorizedException on invalid refresh token', async () => {
      // Arrange
      console.log('→ Testing error state: Invalid refresh token');
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      // Act & Assert
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('logout', () => {
    it('should call Keycloak logout endpoint', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      // Act
      await service.logout('refresh-token-123');

      // Assert
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/protocol/openid-connect/logout'),
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    it('should not throw on logout failure', async () => {
      // Arrange
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: jest.fn().mockResolvedValue('Logout failed'),
      });

      // Act & Assert - should not throw
      await expect(service.logout('token')).resolves.not.toThrow();
    });
  });

  describe('validateToken', () => {
    it('should return user profile from valid token', async () => {
      // Arrange - create a mock JWT token payload
      const mockPayload = {
        sub: 'user-id-123',
        preferred_username: 'testuser',
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User',
        exp: Math.floor(Date.now() / 1000) + 3600, // Expires in 1 hour
        realm_access: { roles: ['user', 'admin'] },
        resource_access: {
          'test-client': { roles: ['client-role'] },
        },
      };

      // Create a simple JWT (header.payload.signature)
      const mockToken = `header.${Buffer.from(JSON.stringify(mockPayload)).toString('base64')}.signature`;

      // Act
      const result = await service.validateToken(mockToken);

      // Assert
      expect(result).toMatchObject({
        id: 'user-id-123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });
      expect(result.roles).toContain('user');
      expect(result.roles).toContain('admin');
      expect(result.roles).toContain('client-role');
    });

    it('should throw UnauthorizedException for expired token', async () => {
      // Arrange - create expired token
      console.log('→ Testing error state: Expired JWT token');
      const mockPayload = {
        sub: 'user-id',
        preferred_username: 'test',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      const mockToken = `header.${Buffer.from(JSON.stringify(mockPayload)).toString('base64')}.signature`;

      // Act & Assert
      await expect(service.validateToken(mockToken)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should throw UnauthorizedException for invalid token format', async () => {
      // Arrange
      console.log('→ Testing error state: Invalid JWT format');

      // Act & Assert
      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});
