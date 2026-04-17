/**
 * Unit test for KeycloakAuthController
 * Tests controller logic with mocked service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { KeycloakAuthController } from './keycloak-auth.controller';
import { KeycloakAuthService } from '../services/keycloak-auth.service';
import { Request, Response } from 'express';

describe('KeycloakAuthController (Unit)', () => {
  let controller: KeycloakAuthController;
  let mockAuthService: jest.Mocked<KeycloakAuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(async () => {
    // Create mock service
    mockAuthService = {
      login: jest.fn(),
      logout: jest.fn(),
      refreshToken: jest.fn(),
      validateToken: jest.fn(),
    } as any;

    // Create mock response with chainable methods
    mockResponse = {
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Create mock request
    mockRequest = {
      cookies: {},
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeycloakAuthController],
      providers: [
        { provide: KeycloakAuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<KeycloakAuthController>(KeycloakAuthController);
  });

  describe('login', () => {
    it('should login and set cookies', async () => {
      // Arrange
      const loginDto = { username: 'testuser', password: 'testpass' };
      const mockTokens = {
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        expiresIn: 300,
      };
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        firstName: 'Test',
        lastName: 'User',
      };

      mockAuthService.login.mockResolvedValue(mockTokens);
      mockAuthService.validateToken.mockResolvedValue(mockUser);

      // Act
      await controller.login(loginDto, mockResponse as Response);

      // Assert
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(mockAuthService.validateToken).toHaveBeenCalledWith(mockTokens.accessToken);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockTokens.accessToken,
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockTokens.refreshToken,
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Login successful',
          user: expect.objectContaining({ username: 'testuser' }),
        })
      );
    });

    it('should throw UnauthorizedException on login failure', async () => {
      // Arrange
      console.log('→ Testing error state: Login with invalid credentials');
      const loginDto = { username: 'wrong', password: 'wrong' };
      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      // Act & Assert
      await expect(
        controller.login(loginDto, mockResponse as Response)
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should logout and clear cookies', async () => {
      // Arrange
      mockRequest.cookies = { refresh_token: 'refresh-token-123' };
      mockAuthService.logout.mockResolvedValue(undefined);

      // Act
      await controller.logout(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-token-123');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Logout successful' });
    });

    it('should clear cookies even without refresh token', async () => {
      // Arrange
      mockRequest.cookies = {};

      // Act
      await controller.logout(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.logout).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('refresh', () => {
    it('should refresh token and set new cookies', async () => {
      // Arrange
      mockRequest.cookies = { refresh_token: 'old-refresh-token' };
      const mockNewTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 300,
      };
      mockAuthService.refreshToken.mockResolvedValue(mockNewTokens);

      // Act
      await controller.refresh(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        mockNewTokens.accessToken,
        expect.any(Object)
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        mockNewTokens.refreshToken,
        expect.any(Object)
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should throw UnauthorizedException when refresh token missing', async () => {
      // Arrange
      mockRequest.cookies = {};

      // Act & Assert
      await expect(
        controller.refresh(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should clear cookies on refresh failure', async () => {
      // Arrange
      console.log('→ Testing error state: Refresh with invalid token');
      mockRequest.cookies = { refresh_token: 'invalid-token' };
      mockAuthService.refreshToken.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(
        controller.refresh(mockRequest as Request, mockResponse as Response)
      ).rejects.toThrow(UnauthorizedException);

      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
    });
  });

  describe('checkAuth', () => {
    it('should return user info for authenticated request', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['user'],
        firstName: 'Test',
        lastName: 'User',
      };

      // Act
      await controller.checkAuth(mockUser, mockResponse as Response);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        authenticated: true,
        user: mockUser,
        permissions: ['conversations:read', 'conversations:create'],
      });
    });
  });
});
