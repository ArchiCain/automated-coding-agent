// Types for the CORS package
import { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

export interface CorsConfig {
  origins: string[];
  credentials: boolean;
  methods: string[];
  allowedHeaders: string[];
  optionsSuccessStatus: number;
}

export interface ParsedCorsOrigins {
  origins: string[] | string | boolean;
  raw: string;
}

export type NestJSCorsOptions = CorsOptions;
