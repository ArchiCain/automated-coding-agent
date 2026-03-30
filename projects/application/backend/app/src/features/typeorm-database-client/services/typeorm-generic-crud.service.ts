import { Injectable } from "@nestjs/common";
import {
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOptionsWhere,
  DeepPartial,
  Repository,
  ObjectLiteral,
} from "typeorm";
import { InjectEntityManager } from "@nestjs/typeorm";

/**
 * Generic database service that provides common CRUD operations for any entity.
 * Follows the repository pattern and provides type-safe operations.
 */
@Injectable()
export class TypeormGenericCrudService {
  constructor(
    @InjectEntityManager()
    private entityManager: EntityManager,
  ) {}

  /**
   * Get a typed repository for a specific entity
   */
  getRepository<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
  ): Repository<T> {
    return this.entityManager.getRepository(entityClass);
  }

  /**
   * Find all entities matching the given options
   */
  async findAll<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    return this.entityManager.find(entityClass, options);
  }

  /**
   * Find one entity matching the given criteria
   */
  async findOne<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
  ): Promise<T | null> {
    return this.entityManager.findOne(entityClass, { where: criteria });
  }

  /**
   * Find one entity by ID
   */
  async findById<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
  ): Promise<T | null> {
    return this.entityManager.findOne(entityClass, {
      where: { id } as FindOptionsWhere<T>,
    });
  }

  /**
   * Create a new entity
   */
  async create<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    data: DeepPartial<T>,
  ): Promise<T> {
    const entity = this.entityManager.create(entityClass, data);
    return this.entityManager.save(entity);
  }

  /**
   * Update an entity by ID
   */
  async update<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
    data: DeepPartial<T>,
  ): Promise<T | null> {
    await this.entityManager.update(entityClass, id, data as any);
    return this.findById(entityClass, id);
  }

  /**
   * Update entities matching the given criteria
   */
  async updateByCriteria<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
    data: DeepPartial<T>,
  ): Promise<void> {
    await this.entityManager.update(entityClass, criteria, data as any);
  }

  /**
   * Soft delete an entity by ID (sets deletedAt timestamp)
   * This is the preferred deletion method - hard deletes are not allowed
   */
  async deleteById<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
  ): Promise<void> {
    await this.entityManager.softDelete(entityClass, id);
  }

  /**
   * Soft delete entities matching the given criteria
   * This is the preferred deletion method - hard deletes are not allowed
   */
  async delete<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
  ): Promise<void> {
    await this.entityManager.softDelete(entityClass, criteria);
  }

  /**
   * DEPRECATED: Hard delete methods are disabled
   * Use deleteById() or delete() which perform soft deletes
   */
  async hardDeleteById<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
  ): Promise<never> {
    throw new Error(
      "Hard deletes are not allowed in this application. Use deleteById() for soft deletion instead.",
    );
  }

  /**
   * DEPRECATED: Hard delete methods are disabled
   * Use deleteById() or delete() which perform soft deletes
   */
  async hardDelete<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
  ): Promise<never> {
    throw new Error(
      "Hard deletes are not allowed in this application. Use delete() for soft deletion instead.",
    );
  }

  /**
   * Create or update an entity based on criteria
   */
  async upsert<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
    data: DeepPartial<T>,
  ): Promise<T> {
    const existing = await this.findOne(entityClass, criteria);

    if (existing) {
      const entityId = (existing as any).id;
      await this.entityManager.update(entityClass, entityId, data as any);
      return this.findOne(entityClass, criteria) as Promise<T>;
    } else {
      const newEntity = this.entityManager.create(entityClass, {
        ...criteria,
        ...data,
      } as DeepPartial<T>);
      return this.entityManager.save(newEntity);
    }
  }

  /**
   * Count entities matching the given criteria
   * Automatically excludes soft-deleted entities
   */
  async count<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria?: FindOptionsWhere<T>,
  ): Promise<number> {
    const repository = this.getRepository(entityClass);
    return repository.countBy(criteria || ({} as any));
  }

  /**
   * Check if an entity exists with the given criteria
   */
  async exists<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
  ): Promise<boolean> {
    const count = await this.count(entityClass, criteria);
    return count > 0;
  }

  /**
   * Execute a custom query
   */
  async query(query: string, parameters?: any[]): Promise<any> {
    return this.entityManager.query(query, parameters);
  }

  /**
   * Get the EntityManager for advanced operations
   */
  getEntityManager(): EntityManager {
    return this.entityManager;
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<T>(
    runInTransaction: (entityManager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.entityManager.transaction(runInTransaction);
  }

  /**
   * Soft delete an entity by ID (sets deletedAt timestamp)
   * Alias for deleteById() - both methods perform soft deletes
   */
  async softDelete<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
  ): Promise<void> {
    await this.entityManager.softDelete(entityClass, id);
  }

  /**
   * Soft delete entities matching the given criteria
   */
  async softDeleteByCriteria<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
  ): Promise<void> {
    await this.entityManager.softDelete(entityClass, criteria);
  }

  /**
   * Restore a soft-deleted entity by ID
   */
  async restore<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
  ): Promise<void> {
    await this.entityManager.restore(entityClass, id);
  }

  /**
   * Restore soft-deleted entities matching the given criteria
   */
  async restoreByCriteria<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    criteria: FindOptionsWhere<T>,
  ): Promise<void> {
    await this.entityManager.restore(entityClass, criteria);
  }

  /**
   * Find entities including soft-deleted ones
   */
  async findAllWithDeleted<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    return this.entityManager.find(entityClass, {
      ...options,
      withDeleted: true,
    });
  }

  /**
   * Find only soft-deleted entities
   */
  async findDeleted<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    options?: FindManyOptions<T>,
  ): Promise<T[]> {
    return this.entityManager.find(entityClass, {
      ...options,
      where: {
        ...options?.where,
        deletedAt: { $ne: null },
      } as FindOptionsWhere<T>,
      withDeleted: true,
    });
  }

  /**
   * Check if an entity is soft deleted
   */
  async isSoftDeleted<T extends ObjectLiteral>(
    entityClass: EntityTarget<T>,
    id: any,
  ): Promise<boolean> {
    const entity = await this.entityManager.findOne(entityClass, {
      where: { id } as FindOptionsWhere<T>,
      withDeleted: true,
    });
    return entity && (entity as any).deletedAt !== null;
  }
}
