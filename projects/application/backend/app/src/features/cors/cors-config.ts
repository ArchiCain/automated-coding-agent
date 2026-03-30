import { CorsConfig, ParsedCorsOrigins, NestJSCorsOptions } from "./types";

/**
 * Parses comma-delimited CORS_ORIGINS environment variable
 * Handles special cases like '*' for all origins and 'false' for no CORS
 */
export function parseCorsOrigins(corsOrigins?: string): ParsedCorsOrigins {
  if (!corsOrigins || corsOrigins.trim() === "") {
    return {
      origins: false,
      raw: corsOrigins || "",
    };
  }

  const trimmed = corsOrigins.trim().toLowerCase();

  // Handle special cases
  if (trimmed === "*") {
    return {
      origins: true, // NestJS uses true for allow all
      raw: corsOrigins,
    };
  }

  if (trimmed === "false" || trimmed === "none") {
    return {
      origins: false,
      raw: corsOrigins,
    };
  }

  // Parse comma-delimited list
  const origins = corsOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return {
    origins: origins.length > 0 ? origins : false,
    raw: corsOrigins,
  };
}

/**
 * Creates a complete CORS configuration object for NestJS
 */
export function createCorsConfig(corsOrigins?: string): NestJSCorsOptions {
  const parsed = parseCorsOrigins(corsOrigins);

  const config: NestJSCorsOptions = {
    origin: parsed.origins,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Accept",
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "Range",
    ],
    credentials: true, // Allow cookies and auth headers
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  };

  // If no origins are allowed, disable credentials
  if (parsed.origins === false) {
    config.credentials = false;
  }

  return config;
}

/**
 * Gets CORS configuration from environment variables
 */
export function getCorsConfigFromEnv(): NestJSCorsOptions {
  const corsOrigins = process.env.CORS_ORIGINS;
  return createCorsConfig(corsOrigins);
}

/**
 * Validates CORS origins format
 */
export function validateCorsOrigins(corsOrigins: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!corsOrigins) {
    return { valid: true, errors: [] }; // Empty is valid (disables CORS)
  }

  const trimmed = corsOrigins.trim();

  // Special cases are always valid
  if (["*", "false", "none"].includes(trimmed.toLowerCase())) {
    return { valid: true, errors: [] };
  }

  // Validate each origin
  const origins = trimmed.split(",").map((o) => o.trim());

  for (const origin of origins) {
    if (origin.length === 0) {
      errors.push("Empty origin found in comma-delimited list");
      continue;
    }

    // Basic URL validation
    try {
      new URL(origin);
    } catch {
      // Not a full URL, check if it's localhost or IP pattern
      const localhostPattern = /^https?:\/\/localhost(:\d+)?$/;
      const ipPattern =
        /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/;

      if (!localhostPattern.test(origin) && !ipPattern.test(origin)) {
        errors.push(`Invalid origin format: ${origin}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
