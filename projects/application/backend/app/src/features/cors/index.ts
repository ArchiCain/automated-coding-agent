// CORS Package
// Self-contained package for handling CORS configuration with environment variables

export { CorsModule } from "./cors.module";
export { CorsService } from "./services/cors.service";
export {
  createCorsConfig,
  getCorsConfigFromEnv,
  parseCorsOrigins,
  validateCorsOrigins,
} from "./cors-config";
export type { CorsConfig, ParsedCorsOrigins, NestJSCorsOptions } from "./types";
