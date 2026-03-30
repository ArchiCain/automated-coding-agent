import { Injectable, Logger } from "@nestjs/common";
import {
  getCorsConfigFromEnv,
  validateCorsOrigins,
  parseCorsOrigins,
} from "./cors-config";
import { NestJSCorsOptions } from "./types";

@Injectable()
export class CorsService {
  private readonly logger = new Logger(CorsService.name);
  private corsConfig: NestJSCorsOptions;

  constructor() {
    this.corsConfig = this.initializeCorsConfig();
  }

  private initializeCorsConfig(): NestJSCorsOptions {
    const corsOrigins = process.env.CODING_AGENT_CORS_ORIGINS;

    // Validate CORS origins format
    if (corsOrigins) {
      const validation = validateCorsOrigins(corsOrigins);
      if (!validation.valid) {
        this.logger.error(
          "Invalid CODING_AGENT_CORS_ORIGINS configuration:",
          validation.errors,
        );
        throw new Error(
          `Invalid CODING_AGENT_CORS_ORIGINS: ${validation.errors.join(", ")}`,
        );
      }
    }

    const config = getCorsConfigFromEnv();
    const parsed = parseCorsOrigins(corsOrigins);

    // Log CORS configuration for debugging
    this.logger.log("CORS Configuration initialized");
    this.logger.log(`Origins: ${this.formatOriginsForLog(parsed.origins)}`);
    this.logger.log(`Credentials: ${config.credentials}`);
    this.logger.log(
      `Methods: ${Array.isArray(config.methods) ? config.methods.join(", ") : config.methods}`,
    );

    return config;
  }

  private formatOriginsForLog(origins: string[] | string | boolean): string {
    if (origins === true) return "All origins (*)";
    if (origins === false) return "No origins (CORS disabled)";
    if (Array.isArray(origins)) return origins.join(", ");
    return String(origins);
  }

  /**
   * Get the current CORS configuration
   */
  getCorsConfig(): NestJSCorsOptions {
    return this.corsConfig;
  }

  /**
   * Check if an origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (this.corsConfig.origin === true) return true;
    if (this.corsConfig.origin === false) return false;
    if (Array.isArray(this.corsConfig.origin)) {
      return this.corsConfig.origin.includes(origin);
    }
    return false;
  }

  /**
   * Get allowed origins as array
   */
  getAllowedOrigins(): string[] | null {
    if (this.corsConfig.origin === true) return null; // All origins
    if (this.corsConfig.origin === false) return []; // No origins
    if (Array.isArray(this.corsConfig.origin)) {
      return this.corsConfig.origin.filter(
        (origin) => typeof origin === "string",
      ) as string[];
    }
    return [];
  }

  /**
   * Refresh CORS configuration from environment variables
   * Useful for runtime configuration updates
   */
  refreshConfig(): void {
    this.corsConfig = this.initializeCorsConfig();
    this.logger.log("CORS configuration refreshed from environment variables");
  }
}
