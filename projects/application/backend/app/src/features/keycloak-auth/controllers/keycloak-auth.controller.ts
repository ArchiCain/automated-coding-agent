import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  Req,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { KeycloakAuthService } from "../services/keycloak-auth.service";
import { LoginDto, KeycloakUserProfile } from "../keycloak-types";
import { Request, Response } from "express";
import { Public } from "../decorators/public.decorator";
import { KeycloakUser } from "../decorators/keycloak-user.decorator";

@Controller("auth")
export class KeycloakAuthController {
  private readonly logger = new Logger(KeycloakAuthController.name);
  private readonly cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? ("strict" as const)
        : ("lax" as const),
    path: "/",
  };

  constructor(private authService: KeycloakAuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body() loginDto: LoginDto,
    @Res() response: Response
  ): Promise<void> {
    try {
      const tokens = await this.authService.login(loginDto);

      // Set tokens in HTTP-only cookies
      response.cookie("access_token", tokens.accessToken, {
        ...this.cookieOptions,
        maxAge: tokens.expiresIn * 1000, // Convert to milliseconds
      });

      response.cookie("refresh_token", tokens.refreshToken, {
        ...this.cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const user = await this.authService.validateToken(tokens.accessToken);

      response.status(200).json({
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          roles: user.roles,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      this.logger.error(`Login failed: ${error.message}`);
      throw new UnauthorizedException("Invalid credentials");
    }
  }

  @Post("logout")
  async logout(
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const refreshToken = request.cookies["refresh_token"];

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    // Clear cookies regardless of backend logout success
    response.clearCookie("access_token", { path: "/" });
    response.clearCookie("refresh_token", { path: "/" });

    response.status(200).json({ message: "Logout successful" });
  }

  @Post("refresh")
  async refresh(
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const refreshToken = request.cookies["refresh_token"];

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    try {
      const tokens = await this.authService.refreshToken(refreshToken);

      response.cookie("access_token", tokens.accessToken, {
        ...this.cookieOptions,
        maxAge: tokens.expiresIn * 1000,
      });

      response.cookie("refresh_token", tokens.refreshToken, {
        ...this.cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      response.status(200).json({ message: "Token refreshed successfully" });
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);

      // Clear cookies on failed refresh
      response.clearCookie("access_token", { path: "/" });
      response.clearCookie("refresh_token", { path: "/" });

      throw new UnauthorizedException("Failed to refresh token");
    }
  }

  @Get("check")
  async checkAuth(
    @KeycloakUser() user: KeycloakUserProfile,
    @Res() response: Response
  ): Promise<void> {
    response.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  }
}
