import { Controller, Get } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { Public } from "../../keycloak-auth";

@Controller("health")
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  @Public()
  @Get()
  check() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "backend",
    };
  }

  @Get("database")
  async getDatabase(): Promise<
    { connected: true; tables: string[] }
    | { connected: false; error: string }
  > {
    if (!this.dataSource.isInitialized) {
      return { connected: false, error: "Data source not initialized" };
    }

    try {
      const rows: Array<{ tablename: string }> = await this.dataSource.query(
        "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename",
      );
      return { connected: true, tables: rows.map((r) => r.tablename) };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
