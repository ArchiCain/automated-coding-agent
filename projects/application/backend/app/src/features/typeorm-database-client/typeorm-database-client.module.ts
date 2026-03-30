import { Module, DynamicModule } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeormGenericCrudService } from "./services/typeorm-generic-crud.service";
import { ExampleCrudController } from "./controllers/example-crud.controller";
import * as Entities from "./entities";

@Module({})
export class TypeormDatabaseClientModule {
  /**
   * Register the TypeORM Database Client module
   *
   * Connects to PostgreSQL using these environment variables:
   * - DATABASE_HOST: Database host (default: localhost)
   * - DATABASE_PORT: Database port (default: 5432)
   * - DATABASE_USERNAME: Database username (default: postgres)
   * - DATABASE_PASSWORD: Database password (default: postgres)
   * - DATABASE_NAME: Database name (default: postgres)
   * - DATABASE_SSL: Whether to use SSL (default: false)
   * - DATABASE_SYNC: Whether to sync schema (default: false)
   * - DATABASE_LOGGING: Whether to enable logging (default: false)
   */
  static forRoot(): DynamicModule {
    const host = process.env.DATABASE_HOST;
    const port = parseInt(process.env.DATABASE_PORT);
    const username = process.env.DATABASE_USERNAME;
    const password = process.env.DATABASE_PASSWORD;
    const database = process.env.DATABASE_NAME;
    const ssl = process.env.DATABASE_SSL === "true";
    const synchronize = false; // Set to false because it's a dangerous setting that updates the database.
    const logging = process.env.DATABASE_LOGGING === "true";

    // Validate required environment variables
    if (!host || !port || !username || !password || !database) {
      throw new Error(
        'Missing required database environment variables. Please ensure DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, and DATABASE_NAME are set in your .env file.'
      );
    }

    const typeOrmConfig = {
      type: "postgres" as const,
      host,
      port,
      username,
      password,
      database,
      entities: Object.values(Entities) as Function[],
      synchronize,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      logging,

      // Enable migrations (within this package)
      migrations: [__dirname + "/migrations/*.{ts,js}"],
      migrationsRun: true,  // Auto-run migrations on startup
      migrationsTableName: "typeorm_migrations",
    };

    return {
      module: TypeormDatabaseClientModule,
      global: true,
      imports: [TypeOrmModule.forRoot(typeOrmConfig)],
      controllers: [ExampleCrudController],
      providers: [TypeormGenericCrudService],
      exports: [TypeOrmModule, TypeormGenericCrudService],
    };
  }
}
