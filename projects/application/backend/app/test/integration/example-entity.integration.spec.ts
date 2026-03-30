/**
 * Integration test for ExampleEntity using the generic CRUD service
 * This pattern should be used for all entity integration tests
 *
 * Test Pattern:
 * - Uses real database with transaction rollback
 * - Tests all CRUD operations: create, read, update, delete, restore
 * - Verifies soft delete behavior
 * - Verifies base entity fields (id, createdAt, updatedAt, deletedAt)
 * - Tests directly against database (not via HTTP endpoints)
 */

import { DataSource, EntityManager } from 'typeorm';
import { ExampleEntity } from '../../src/packages/typeorm-database-client/entities/example.entity';
import { TypeormGenericCrudService } from '../../src/packages/typeorm-database-client/typeorm-generic-crud.service';
import { AppDataSource } from '../../src/packages/typeorm-database-client/data-source';
import { TransactionHelper } from '../test-helpers';

describe('ExampleEntity Integration', () => {
  let dataSource: DataSource;
  let crudService: TypeormGenericCrudService;
  let transactionHelper: TransactionHelper;
  let entityManager: EntityManager;

  beforeAll(async () => {
    // Connect to the real database
    dataSource = await AppDataSource.initialize();
    crudService = new TypeormGenericCrudService(dataSource.manager);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    transactionHelper = new TransactionHelper(dataSource);
    entityManager = await transactionHelper.start();
    // Use the transaction entity manager for CRUD service
    crudService = new TypeormGenericCrudService(entityManager);
  });

  afterEach(async () => {
    await transactionHelper.rollback();
  });

  describe('CREATE operations', () => {
    it('should create a new example entity', async () => {
      // Arrange
      const createData = {
        name: 'Test Example',
        description: 'Test description',
        metadata: { key: 'value' },
      };

      // Act
      const created = await crudService.create(ExampleEntity, createData);

      // Assert
      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(createData.name);
      expect(created.description).toBe(createData.description);
      expect(created.metadata).toEqual(createData.metadata);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(created.deletedAt).toBeNull();
    });

    it('should auto-generate UUID for id', async () => {
      // Arrange
      const createData = { name: 'UUID Test' };

      // Act
      const created = await crudService.create(ExampleEntity, createData) as ExampleEntity;

      // Assert
      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      // Arrange
      const createData = { name: 'Timestamp Test' };
      const beforeCreate = new Date();
      beforeCreate.setMilliseconds(beforeCreate.getMilliseconds() - 10); // 10ms buffer

      // Act
      const created = await crudService.create(ExampleEntity, createData) as ExampleEntity;

      // Assert
      const afterCreate = new Date();
      afterCreate.setMilliseconds(afterCreate.getMilliseconds() + 10); // 10ms buffer
      expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(created.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
      expect(created.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(created.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  describe('READ operations', () => {
    let testEntity: ExampleEntity;

    beforeEach(async () => {
      testEntity = await crudService.create(ExampleEntity, {
        name: 'Read Test',
        description: 'For read operations',
      });
    });

    it('should find entity by ID', async () => {
      // Act
      const found = await crudService.findById(ExampleEntity, testEntity.id);

      // Assert
      expect(found).toBeDefined();
      expect(found.id).toBe(testEntity.id);
      expect(found.name).toBe(testEntity.name);
    });

    it('should find one entity by criteria', async () => {
      // Act
      const found = await crudService.findOne(ExampleEntity, { name: 'Read Test' });

      // Assert
      expect(found).toBeDefined();
      expect(found.id).toBe(testEntity.id);
    });

    it('should find all entities', async () => {
      // Create another entity
      await crudService.create(ExampleEntity, { name: 'Another Entity' });

      // Act
      const all = await crudService.findAll(ExampleEntity);

      // Assert
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect(all.some(e => e.id === testEntity.id)).toBe(true);
    });

    it('should count entities', async () => {
      // Act
      const count = await crudService.count(ExampleEntity);

      // Assert
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('should check if entity exists', async () => {
      // Act
      const exists = await crudService.exists(ExampleEntity, { id: testEntity.id });

      // Assert
      expect(exists).toBe(true);
    });

    it('should return null for non-existent entity', async () => {
      // Act
      const found = await crudService.findById(
        ExampleEntity,
        '00000000-0000-0000-0000-000000000000'
      );

      // Assert
      expect(found).toBeNull();
    });
  });

  describe('UPDATE operations', () => {
    let testEntity: ExampleEntity;

    beforeEach(async () => {
      testEntity = await crudService.create(ExampleEntity, {
        name: 'Original Name',
        description: 'Original description',
        metadata: { version: 1 },
      });
    });

    it('should update entity by ID', async () => {
      // Arrange
      const updateData = {
        name: 'Updated Name',
        description: 'Updated description',
      };

      // Small delay to ensure updatedAt timestamp will be different
      await new Promise(resolve => setTimeout(resolve, 10));

      // Act
      const updated = await crudService.update(ExampleEntity, testEntity.id, updateData) as ExampleEntity;

      // Assert
      expect(updated).toBeDefined();
      expect(updated!.id).toBe(testEntity.id);
      expect(updated!.name).toBe(updateData.name);
      expect(updated!.description).toBe(updateData.description);
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(testEntity.updatedAt.getTime());
    });

    it('should partially update entity (only specified fields)', async () => {
      // Arrange
      const updateData = { name: 'Only Name Updated' };

      // Act
      const updated = await crudService.update(ExampleEntity, testEntity.id, updateData) as ExampleEntity;

      // Assert
      expect(updated!.name).toBe(updateData.name);
      expect(updated!.description).toBe(testEntity.description); // Should remain unchanged
    });

    it('should perform upsert (update existing)', async () => {
      // Act
      const upserted = await crudService.upsert(
        ExampleEntity,
        { id: testEntity.id },
        { name: 'Upserted Name' }
      );

      // Assert
      expect(upserted.id).toBe(testEntity.id);
      expect(upserted.name).toBe('Upserted Name');
    });

    it('should perform upsert (create new)', async () => {
      // Act
      const upserted = await crudService.upsert(
        ExampleEntity,
        { name: 'New Via Upsert' },
        { description: 'Created via upsert' }
      );

      // Assert
      expect(upserted).toBeDefined();
      expect(upserted.name).toBe('New Via Upsert');
      expect(upserted.description).toBe('Created via upsert');
    });
  });

  describe('SOFT DELETE operations', () => {
    let testEntity: ExampleEntity;

    beforeEach(async () => {
      testEntity = await crudService.create(ExampleEntity, {
        name: 'To Be Deleted',
        description: 'This will be soft deleted',
      });
    });

    it('should soft delete entity by ID', async () => {
      // Act
      await crudService.deleteById(ExampleEntity, testEntity.id);

      // Assert
      const found = await crudService.findById(ExampleEntity, testEntity.id);
      expect(found).toBeNull(); // Soft deleted entities are not found by default
    });

    it('should set deletedAt timestamp on soft delete', async () => {
      // Act
      await crudService.softDelete(ExampleEntity, testEntity.id);

      // Assert
      const withDeleted = await crudService.findAllWithDeleted(ExampleEntity, {
        where: { id: testEntity.id },
      });
      expect(withDeleted.length).toBe(1);
      expect(withDeleted[0].deletedAt).not.toBeNull();
      expect(withDeleted[0].deletedAt).toBeInstanceOf(Date);
    });

    it('should check if entity is soft deleted', async () => {
      // Act
      await crudService.softDelete(ExampleEntity, testEntity.id);

      // Assert
      const isSoftDeleted = await crudService.isSoftDeleted(ExampleEntity, testEntity.id);
      expect(isSoftDeleted).toBe(true);
    });

    it('should find entity with withDeleted option', async () => {
      // Act
      await crudService.softDelete(ExampleEntity, testEntity.id);

      // Assert
      const found = await entityManager.findOne(ExampleEntity, {
        where: { id: testEntity.id },
        withDeleted: true,
      });
      expect(found).toBeDefined();
      expect(found.deletedAt).not.toBeNull();
    });

    it('should exclude soft deleted entities from count by default', async () => {
      // Arrange
      const countBefore = await crudService.count(ExampleEntity);

      // Act
      await crudService.softDelete(ExampleEntity, testEntity.id);

      // Assert
      const countAfter = await crudService.count(ExampleEntity);
      expect(countAfter).toBe(countBefore - 1);
    });
  });

  describe('RESTORE operations', () => {
    let testEntity: ExampleEntity;

    beforeEach(async () => {
      testEntity = await crudService.create(ExampleEntity, {
        name: 'To Be Restored',
      });
      await crudService.softDelete(ExampleEntity, testEntity.id);
    });

    it('should restore soft deleted entity', async () => {
      // Act
      await crudService.restore(ExampleEntity, testEntity.id);

      // Assert
      const found = await crudService.findById(ExampleEntity, testEntity.id);
      expect(found).toBeDefined();
      expect(found.deletedAt).toBeNull();
    });

    it('should restore entity by criteria', async () => {
      // Act
      await crudService.restoreByCriteria(ExampleEntity, { id: testEntity.id });

      // Assert
      const found = await crudService.findById(ExampleEntity, testEntity.id);
      expect(found).toBeDefined();
      expect(found.deletedAt).toBeNull();
    });

    it('should restore entity and make it findable again', async () => {
      // Arrange
      const beforeRestore = await crudService.findById(ExampleEntity, testEntity.id);
      expect(beforeRestore).toBeNull();

      // Act
      await crudService.restore(ExampleEntity, testEntity.id);

      // Assert
      const afterRestore = await crudService.findById(ExampleEntity, testEntity.id);
      expect(afterRestore).toBeDefined();
    });
  });

  describe('HARD DELETE prevention', () => {
    let testEntity: ExampleEntity;

    beforeEach(async () => {
      testEntity = await crudService.create(ExampleEntity, {
        name: 'Protected from hard delete',
      });
    });

    it('should throw error on hard delete attempt', async () => {
      // Act & Assert
      await expect(
        crudService.hardDeleteById(ExampleEntity, testEntity.id)
      ).rejects.toThrow('Hard deletes are not allowed');
    });

    it('should throw error on hard delete by criteria', async () => {
      // Act & Assert
      await expect(
        crudService.hardDelete(ExampleEntity, { id: testEntity.id })
      ).rejects.toThrow('Hard deletes are not allowed');
    });
  });

  describe('Transaction rollback verification', () => {
    it('should rollback all operations after test', async () => {
      // Arrange
      const createData = { name: 'Should Be Rolled Back' };

      // Act
      const created = await crudService.create(ExampleEntity, createData) as ExampleEntity;
      const createdId = created.id;

      // Verify it exists in this transaction
      const foundInTransaction = await crudService.findById(ExampleEntity, createdId);
      expect(foundInTransaction).toBeDefined();

      // After afterEach() runs, we'll verify in the next test that it's gone
      // Store the ID for verification in next test
      (global as any).lastRolledBackId = createdId;
    });

    it('should confirm previous test data was rolled back', async () => {
      // Assert
      const rolledBackId = (global as any).lastRolledBackId;
      if (rolledBackId) {
        const shouldBeNull = await crudService.findById(ExampleEntity, rolledBackId);
        expect(shouldBeNull).toBeNull();
      }
    });
  });
});
