/**
 * TypeORM DataSource Configuration
 *
 * This file is used by TypeORM CLI for migration commands.
 * Migrations are also auto-run on app startup via TypeormDatabaseClientModule.
 */

import { DataSource } from "typeorm";
import * as Entities from "./entities";

// Validate required environment variables
const requiredEnvVars = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USERNAME', 'DATABASE_PASSWORD', 'DATABASE_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(
    `Missing required database environment variables: ${missingVars.join(', ')}. ` +
    'Please ensure all database configuration is set in your .env file.'
  );
}

export const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,

  // Entities
  entities: Object.values(Entities),

  // Migrations (within this package)
  migrations: ["src/features/typeorm-database-client/migrations/*.ts"],

  // Never use synchronize in production!
  synchronize: false,

  // Logging
  logging: process.env.DATABASE_LOGGING === "true",
});
