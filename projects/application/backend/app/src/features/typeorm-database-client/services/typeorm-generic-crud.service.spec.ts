/**
 * Unit test for TypeormGenericCrudService
 * Tests generic CRUD operations with mocked EntityManager
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeormGenericCrudService } from './typeorm-generic-crud.service';
import { EntityManager, Repository } from 'typeorm';
import { ExampleEntity } from './entities/example.entity';

describe('TypeormGenericCrudService (Unit)', () => {
  let service: TypeormGenericCrudService;
  let mockEntityManager: jest.Mocked<EntityManager>;
  let mockRepository: jest.Mocked<Repository<ExampleEntity>>;

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      count: jest.fn(),
      countBy: jest.fn(),
      create: jest.fn(),
    } as any;

    // Create mock entity manager
    mockEntityManager = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      count: jest.fn(),
      query: jest.fn(),
      transaction: jest.fn(),
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    // Directly instantiate service with mock (no NestJS DI needed for unit tests)
    service = new TypeormGenericCrudService(mockEntityManager);
  });

  describe('getRepository', () => {
    it('should return repository for entity', () => {
      // Act
      const repository = service.getRepository(ExampleEntity);

      // Assert
      expect(repository).toBe(mockRepository);
      expect(mockEntityManager.getRepository).toHaveBeenCalledWith(ExampleEntity);
    });
  });

  describe('findAll', () => {
    it('should find all entities', async () => {
      // Arrange
      const mockEntities = [{ id: '1', name: 'Test' }] as ExampleEntity[];
      mockEntityManager.find.mockResolvedValue(mockEntities);

      // Act
      const result = await service.findAll(ExampleEntity);

      // Assert
      expect(result).toEqual(mockEntities);
      expect(mockEntityManager.find).toHaveBeenCalledWith(ExampleEntity, undefined);
    });

    it('should apply find options', async () => {
      // Arrange
      const options = { where: { name: 'Test' }, take: 10 };
      mockEntityManager.find.mockResolvedValue([]);

      // Act
      await service.findAll(ExampleEntity, options);

      // Assert
      expect(mockEntityManager.find).toHaveBeenCalledWith(ExampleEntity, options);
    });
  });

  describe('findOne', () => {
    it('should find one entity by criteria', async () => {
      // Arrange
      const mockEntity = { id: '1', name: 'Test' } as ExampleEntity;
      mockEntityManager.findOne.mockResolvedValue(mockEntity);

      // Act
      const result = await service.findOne(ExampleEntity, { name: 'Test' });

      // Assert
      expect(result).toEqual(mockEntity);
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(ExampleEntity, {
        where: { name: 'Test' },
      });
    });
  });

  describe('findById', () => {
    it('should find entity by id', async () => {
      // Arrange
      const mockEntity = { id: '1', name: 'Test' } as ExampleEntity;
      mockEntityManager.findOne.mockResolvedValue(mockEntity);

      // Act
      const result = await service.findById(ExampleEntity, '1');

      // Assert
      expect(result).toEqual(mockEntity);
      expect(mockEntityManager.findOne).toHaveBeenCalledWith(ExampleEntity, {
        where: { id: '1' },
      });
    });
  });

  describe('create', () => {
    it('should create new entity', async () => {
      // Arrange
      const createData = { name: 'New Entity' };
      const mockCreated = { id: '1', ...createData } as ExampleEntity;
      mockEntityManager.create.mockReturnValue(mockCreated as any);
      mockEntityManager.save.mockResolvedValue(mockCreated);

      // Act
      const result = await service.create(ExampleEntity, createData);

      // Assert
      expect(result).toEqual(mockCreated);
      expect(mockEntityManager.create).toHaveBeenCalledWith(ExampleEntity, createData);
      expect(mockEntityManager.save).toHaveBeenCalledWith(mockCreated);
    });
  });

  describe('update', () => {
    it('should update entity and return updated version', async () => {
      // Arrange
      const updateData = { name: 'Updated' };
      const mockUpdated = { id: '1', name: 'Updated' } as ExampleEntity;
      mockEntityManager.update.mockResolvedValue(undefined as any);
      mockEntityManager.findOne.mockResolvedValue(mockUpdated);

      // Act
      const result = await service.update(ExampleEntity, '1', updateData);

      // Assert
      expect(result).toEqual(mockUpdated);
      expect(mockEntityManager.update).toHaveBeenCalledWith(ExampleEntity, '1', updateData);
    });
  });

  describe('deleteById', () => {
    it('should soft delete entity by id', async () => {
      // Arrange
      mockEntityManager.softDelete.mockResolvedValue(undefined as any);

      // Act
      await service.deleteById(ExampleEntity, '1');

      // Assert
      expect(mockEntityManager.softDelete).toHaveBeenCalledWith(ExampleEntity, '1');
    });
  });

  describe('hardDeleteById', () => {
    it('should throw error when attempting hard delete', async () => {
      // Act & Assert
      await expect(
        service.hardDeleteById(ExampleEntity, '1')
      ).rejects.toThrow('Hard deletes are not allowed');
    });
  });

  describe('hardDelete', () => {
    it('should throw error when attempting hard delete by criteria', async () => {
      // Act & Assert
      await expect(
        service.hardDelete(ExampleEntity, { id: '1' })
      ).rejects.toThrow('Hard deletes are not allowed');
    });
  });

  describe('restore', () => {
    it('should restore soft deleted entity', async () => {
      // Arrange
      mockEntityManager.restore.mockResolvedValue(undefined as any);

      // Act
      await service.restore(ExampleEntity, '1');

      // Assert
      expect(mockEntityManager.restore).toHaveBeenCalledWith(ExampleEntity, '1');
    });
  });

  describe('count', () => {
    it('should count entities', async () => {
      // Arrange
      mockRepository.countBy.mockResolvedValue(5);

      // Act
      const result = await service.count(ExampleEntity);

      // Assert
      expect(result).toBe(5);
      expect(mockRepository.countBy).toHaveBeenCalledWith({});
    });

    it('should count entities with criteria', async () => {
      // Arrange
      mockRepository.countBy.mockResolvedValue(2);

      // Act
      const result = await service.count(ExampleEntity, { name: 'Test' });

      // Assert
      expect(result).toBe(2);
      expect(mockRepository.countBy).toHaveBeenCalledWith({ name: 'Test' });
    });
  });

  describe('exists', () => {
    it('should return true when entity exists', async () => {
      // Arrange
      mockRepository.countBy.mockResolvedValue(1);

      // Act
      const result = await service.exists(ExampleEntity, { id: '1' });

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when entity does not exist', async () => {
      // Arrange
      mockRepository.countBy.mockResolvedValue(0);

      // Act
      const result = await service.exists(ExampleEntity, { id: '999' });

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('upsert', () => {
    it('should update existing entity', async () => {
      // Arrange
      const existing = { id: '1', name: 'Existing' } as ExampleEntity;
      const updateData = { name: 'Updated' };
      const updated = { id: '1', name: 'Updated' } as ExampleEntity;

      mockEntityManager.findOne
        .mockResolvedValueOnce(existing) // First call in upsert
        .mockResolvedValueOnce(updated); // Second call after update

      mockEntityManager.update.mockResolvedValue(undefined as any);

      // Act
      const result = await service.upsert(ExampleEntity, { id: '1' } as any, updateData);

      // Assert
      expect(result).toEqual(updated);
      expect(mockEntityManager.update).toHaveBeenCalled();
    });

    it('should create new entity when not found', async () => {
      // Arrange
      const createData = { name: 'New' };
      const created = { id: '1', name: 'New' } as ExampleEntity;

      mockEntityManager.findOne.mockResolvedValue(null);
      mockEntityManager.create.mockReturnValue(created as any);
      mockEntityManager.save.mockResolvedValue(created);

      // Act
      const result = await service.upsert(ExampleEntity, { name: 'New' }, createData);

      // Assert
      expect(result).toEqual(created);
      expect(mockEntityManager.save).toHaveBeenCalled();
    });
  });

  describe('getEntityManager', () => {
    it('should return entity manager', () => {
      // Act
      const em = service.getEntityManager();

      // Assert
      expect(em).toBe(mockEntityManager);
    });
  });

  describe('transaction', () => {
    it('should execute function in transaction', async () => {
      // Arrange
      const mockCallback = jest.fn().mockResolvedValue('result');
      mockEntityManager.transaction.mockImplementation(async (cb: any) => cb(mockEntityManager));

      // Act
      const result = await service.transaction(mockCallback);

      // Assert
      expect(result).toBe('result');
      expect(mockEntityManager.transaction).toHaveBeenCalled();
      expect(mockCallback).toHaveBeenCalledWith(mockEntityManager);
    });
  });
});
