/**
 * Test helper utilities for integration tests
 */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

/**
 * Create a test application instance
 * This bootstraps the full NestJS application for integration testing
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}

/**
 * Transaction helper for integration tests
 * Wraps test in a transaction that rolls back after test completes
 */
export class TransactionHelper {
  private entityManager: EntityManager;
  private queryRunner: any;

  constructor(private dataSource: DataSource) {}

  async start(): Promise<EntityManager> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();
    this.entityManager = this.queryRunner.manager;
    return this.entityManager;
  }

  async rollback(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.rollbackTransaction();
      await this.queryRunner.release();
    }
  }

  getEntityManager(): EntityManager {
    return this.entityManager;
  }
}

/**
 * Get DataSource from app for transaction testing
 */
export function getDataSource(app: INestApplication): DataSource {
  return app.get(DataSource);
}
