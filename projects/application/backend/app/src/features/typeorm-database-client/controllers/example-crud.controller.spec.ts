/**
 * Unit test for ExampleCrudController
 * Tests controller logic with mocked service
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExampleCrudController } from './example-crud.controller';
import { TypeormGenericCrudService } from './typeorm-generic-crud.service';
import { ExampleEntity } from './entities/example.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ExampleCrudController (Unit)', () => {
  let controller: ExampleCrudController;
  let mockCrudService: jest.Mocked<TypeormGenericCrudService>;

  beforeEach(async () => {
    // Create mock service
    mockCrudService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteById: jest.fn(),
      restore: jest.fn(),
      isSoftDeleted: jest.fn(),
      count: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExampleCrudController],
      providers: [
        { provide: TypeormGenericCrudService, useValue: mockCrudService },
      ],
    }).compile();

    controller = module.get<ExampleCrudController>(ExampleCrudController);
  });

  describe('findAll', () => {
    it('should return all examples', async () => {
      // Arrange
      const mockExamples = [
        { id: '1', name: 'Example 1' } as ExampleEntity,
        { id: '2', name: 'Example 2' } as ExampleEntity,
      ];
      mockCrudService.findAll.mockResolvedValue(mockExamples);

      // Act
      const result = await controller.findAll();

      // Assert
      expect(result).toEqual(mockExamples);
      expect(mockCrudService.findAll).toHaveBeenCalledWith(ExampleEntity, {});
    });

    it('should apply limit and offset pagination', async () => {
      // Arrange
      mockCrudService.findAll.mockResolvedValue([]);

      // Act
      await controller.findAll('10', '20');

      // Assert
      expect(mockCrudService.findAll).toHaveBeenCalledWith(ExampleEntity, {
        take: 10,
        skip: 20,
      });
    });

    it('should filter by name when provided', async () => {
      // Arrange
      mockCrudService.findAll.mockResolvedValue([]);

      // Act
      await controller.findAll(undefined, undefined, 'TestName');

      // Assert
      expect(mockCrudService.findAll).toHaveBeenCalledWith(ExampleEntity, {
        where: { name: 'TestName' },
      });
    });

    it('should throw BadRequestException for invalid limit', async () => {
      // Act & Assert
      await expect(controller.findAll('invalid')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for negative limit', async () => {
      // Act & Assert
      await expect(controller.findAll('-5')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return example by id', async () => {
      // Arrange
      const mockExample = { id: '1', name: 'Example 1' } as ExampleEntity;
      mockCrudService.findById.mockResolvedValue(mockExample);

      // Act
      const result = await controller.findOne('1');

      // Assert
      expect(result).toEqual(mockExample);
      expect(mockCrudService.findById).toHaveBeenCalledWith(ExampleEntity, '1');
    });

    it('should throw NotFoundException when example not found', async () => {
      // Arrange
      mockCrudService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.findOne('999')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      // Act & Assert
      await expect(controller.findOne('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('create', () => {
    it('should create new example', async () => {
      // Arrange
      const createDto = { name: 'New Example', description: 'Test' };
      const mockCreated = { id: '1', ...createDto } as ExampleEntity;
      mockCrudService.findOne.mockResolvedValue(null); // No existing
      mockCrudService.create.mockResolvedValue(mockCreated);

      // Act
      const result = await controller.create(createDto);

      // Assert
      expect(result).toEqual(mockCreated);
      expect(mockCrudService.create).toHaveBeenCalledWith(ExampleEntity, createDto);
    });

    it('should throw BadRequestException when name is missing', async () => {
      // Arrange
      const createDto = { description: 'No name' } as any;

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when name already exists', async () => {
      // Arrange
      const createDto = { name: 'Duplicate' };
      mockCrudService.findOne.mockResolvedValue({ id: '1', name: 'Duplicate' } as ExampleEntity);

      // Act & Assert
      await expect(controller.create(createDto)).rejects.toThrow(BadRequestException);
      expect(mockCrudService.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update existing example', async () => {
      // Arrange
      const updateDto = { name: 'Updated', description: 'Updated desc' };
      const existing = { id: '1', name: 'Original' } as ExampleEntity;
      const updated = { id: '1', ...updateDto } as ExampleEntity;
      mockCrudService.findById.mockResolvedValue(existing);
      mockCrudService.findOne.mockResolvedValue(null); // No name conflict
      mockCrudService.update.mockResolvedValue(updated);

      // Act
      const result = await controller.update('1', updateDto);

      // Assert
      expect(result).toEqual(updated);
      expect(mockCrudService.update).toHaveBeenCalledWith(ExampleEntity, '1', updateDto);
    });

    it('should throw NotFoundException when example not found', async () => {
      // Arrange
      mockCrudService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.update('999', { name: 'Updated' })).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when updating to duplicate name', async () => {
      // Arrange
      const existing = { id: '1', name: 'Original' } as ExampleEntity;
      const conflict = { id: '2', name: 'NewName' } as ExampleEntity;
      mockCrudService.findById.mockResolvedValue(existing);
      mockCrudService.findOne.mockResolvedValue(conflict);

      // Act & Assert
      await expect(controller.update('1', { name: 'NewName' })).rejects.toThrow(BadRequestException);
    });

    it('should allow updating to same name', async () => {
      // Arrange
      const existing = { id: '1', name: 'SameName' } as ExampleEntity;
      const updated = { id: '1', name: 'SameName', description: 'Updated' } as ExampleEntity;
      mockCrudService.findById.mockResolvedValue(existing);
      mockCrudService.findOne.mockResolvedValue(existing); // Same entity
      mockCrudService.update.mockResolvedValue(updated);

      // Act
      const result = await controller.update('1', { name: 'SameName', description: 'Updated' });

      // Assert
      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('should soft delete example by id', async () => {
      // Arrange
      const existing = { id: '1', name: 'ToDelete' } as ExampleEntity;
      mockCrudService.findById.mockResolvedValue(existing);
      mockCrudService.deleteById.mockResolvedValue(undefined);

      // Act
      const result = await controller.delete('1');

      // Assert
      expect(result).toEqual({ message: 'Example with ID 1 has been soft deleted' });
      expect(mockCrudService.deleteById).toHaveBeenCalledWith(ExampleEntity, '1');
    });

    it('should throw NotFoundException when example not found', async () => {
      // Arrange
      mockCrudService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(controller.delete('999')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      // Act & Assert
      await expect(controller.delete('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('count', () => {
    it('should return count of all examples', async () => {
      // Arrange
      mockCrudService.count.mockResolvedValue(5);

      // Act
      const result = await controller.count();

      // Assert
      expect(result).toEqual({ count: 5 });
      expect(mockCrudService.count).toHaveBeenCalledWith(ExampleEntity, undefined);
    });

    it('should return count filtered by name', async () => {
      // Arrange
      mockCrudService.count.mockResolvedValue(2);

      // Act
      const result = await controller.count('SpecificName');

      // Assert
      expect(result).toEqual({ count: 2 });
      expect(mockCrudService.count).toHaveBeenCalledWith(ExampleEntity, { name: 'SpecificName' });
    });
  });

  describe('restore', () => {
    it('should restore soft deleted example', async () => {
      // Arrange
      mockCrudService.isSoftDeleted.mockResolvedValue(true);
      mockCrudService.restore.mockResolvedValue(undefined);

      // Act
      const result = await controller.restore('1');

      // Assert
      expect(result).toEqual({ message: 'Example with ID 1 has been restored' });
      expect(mockCrudService.restore).toHaveBeenCalledWith(ExampleEntity, '1');
    });

    it('should throw BadRequestException when example is not deleted', async () => {
      // Arrange
      mockCrudService.isSoftDeleted.mockResolvedValue(false);

      // Act & Assert
      await expect(controller.restore('1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when id is empty', async () => {
      // Act & Assert
      await expect(controller.restore('')).rejects.toThrow(BadRequestException);
    });
  });
});
