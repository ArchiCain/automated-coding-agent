/**
 * Unit test for HealthController
 * Tests controller logic in isolation (no HTTP).
 */

import { DataSource } from "typeorm";
import { HealthController } from "./health.controller";

describe("HealthController (Unit)", () => {
  const buildController = (overrides: Partial<DataSource> = {}) => {
    const dataSource = {
      isInitialized: true,
      query: jest.fn(),
      ...overrides,
    } as unknown as DataSource;
    return { controller: new HealthController(dataSource), dataSource };
  };

  describe("check", () => {
    it("should return health status object", () => {
      const { controller } = buildController();

      const result = controller.check();

      expect(result).toBeDefined();
      expect(result.status).toBe("ok");
      expect(result.service).toBe("backend");
      expect(result.timestamp).toBeDefined();
    });

    it("should return valid ISO timestamp", () => {
      const { controller } = buildController();

      const result = controller.check();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const date = new Date(result.timestamp);
      expect(date).toBeInstanceOf(Date);
      expect(date.toString()).not.toBe("Invalid Date");
    });

    it("should return current timestamp each time it is called", () => {
      const { controller } = buildController();

      const result1 = controller.check();
      const result2 = controller.check();

      const time1 = new Date(result1.timestamp).getTime();
      const time2 = new Date(result2.timestamp).getTime();
      expect(time2).toBeGreaterThanOrEqual(time1);
    });
  });

  describe("getDatabase", () => {
    it("reports connected with the list of public-schema tables", async () => {
      const { controller, dataSource } = buildController();
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { tablename: "accounts" },
        { tablename: "typeorm_migrations" },
      ]);

      const result = await controller.getDatabase();

      expect(result).toEqual({
        connected: true,
        tables: ["accounts", "typeorm_migrations"],
      });
      expect(dataSource.query).toHaveBeenCalledWith(
        "SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename",
      );
    });

    it("returns connected:false with an error when the DataSource is not initialized", async () => {
      const { controller } = buildController({ isInitialized: false });

      const result = await controller.getDatabase();

      expect(result).toEqual({
        connected: false,
        error: "Data source not initialized",
      });
    });

    it("returns connected:false with the error message when the query throws", async () => {
      const { controller, dataSource } = buildController();
      (dataSource.query as jest.Mock).mockRejectedValueOnce(
        new Error("connection reset"),
      );

      const result = await controller.getDatabase();

      expect(result).toEqual({
        connected: false,
        error: "connection reset",
      });
    });
  });
});
