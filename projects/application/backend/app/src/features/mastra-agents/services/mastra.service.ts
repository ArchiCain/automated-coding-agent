import { Injectable } from "@nestjs/common";
import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { chatAgent } from "../agents/chat-agent";

@Injectable()
export class MastraService {
  private readonly _mastra: Mastra;

  constructor() {
    // For RDS SSL, disable certificate verification globally for this service
    // This allows Mastra to connect without certificate issues
    if (process.env.DATABASE_SSL === "true") {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    // Build connection string from existing env vars
    const connectionString = this.buildConnectionString();

    this._mastra = new Mastra({
      agents: { "chat-agent": chatAgent },
      storage: new PostgresStore({
        connectionString,
        schemaName: 'mastra',
      }),
      observability: {
        default: { enabled: true }
      }
    });
  }

  private buildConnectionString(): string {
    const host = process.env.DATABASE_HOST;
    const port = process.env.DATABASE_PORT;
    const username = process.env.DATABASE_USERNAME;
    const password = process.env.DATABASE_PASSWORD;
    const database = process.env.DATABASE_NAME;
    const useSSL = process.env.DATABASE_SSL === "true";

    // Validate required environment variables
    if (!host || !port || !username || !password || !database) {
      throw new Error(
        'Missing required database environment variables for Mastra. ' +
        'Please ensure DATABASE_HOST, DATABASE_PORT, DATABASE_USERNAME, DATABASE_PASSWORD, and DATABASE_NAME are set in your .env file.'
      );
    }

    // URL-encode credentials to handle special characters
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);

    // For SSL, add sslmode parameter - Node will use NODE_TLS_REJECT_UNAUTHORIZED setting
    const sslParam = useSSL ? "?sslmode=require" : "";

    return `postgresql://${encodedUsername}:${encodedPassword}@${host}:${port}/${database}${sslParam}`;
  }

  get mastra(): Mastra {
    return this._mastra;
  }
}
