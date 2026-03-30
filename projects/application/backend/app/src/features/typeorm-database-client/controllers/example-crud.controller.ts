import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { TypeormGenericCrudService } from "../services/typeorm-generic-crud.service";
import { ExampleEntity } from "../entities/example.entity";
import { DeepPartial, FindManyOptions } from "typeorm";

/**
 * Example CRUD controller demonstrating how to use the TypeormGenericCrudService
 * for basic CRUD operations on the ExampleEntity.
 * This can be used as a template for other entity controllers.
 */
@Controller("examples")
export class ExampleCrudController {
  constructor(private readonly crudService: TypeormGenericCrudService) {}

  /**
   * Get all examples with optional query parameters for filtering
   * GET /examples?limit=10&offset=0
   */
  @Get()
  async findAll(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("name") name?: string,
  ): Promise<ExampleEntity[]> {
    try {
      const findOptions: FindManyOptions<ExampleEntity> = {};

      // Add pagination if provided
      if (limit) {
        const parsedLimit = parseInt(limit, 10);
        if (isNaN(parsedLimit) || parsedLimit < 0) {
          throw new BadRequestException("Invalid limit parameter");
        }
        findOptions.take = parsedLimit;
      }

      if (offset) {
        const parsedOffset = parseInt(offset, 10);
        if (isNaN(parsedOffset) || parsedOffset < 0) {
          throw new BadRequestException("Invalid offset parameter");
        }
        findOptions.skip = parsedOffset;
      }

      // Add name filter if provided
      if (name) {
        findOptions.where = { name };
      }

      return await this.crudService.findAll(ExampleEntity, findOptions);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to retrieve examples",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a single example by ID
   * GET /examples/:id
   */
  @Get(":id")
  async findOne(@Param("id") id: string): Promise<ExampleEntity> {
    try {
      if (!id) {
        throw new BadRequestException("Example ID is required");
      }

      const example = await this.crudService.findById(ExampleEntity, id);

      if (!example) {
        throw new NotFoundException(`Example with ID ${id} not found`);
      }

      return example;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to retrieve example",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new example
   * POST /examples
   */
  @Post()
  async create(@Body() createData: CreateExampleDto): Promise<ExampleEntity> {
    try {
      if (!createData.name) {
        throw new BadRequestException("Name is required");
      }

      // Check if example with same name already exists
      const existingExample = await this.crudService.findOne(ExampleEntity, {
        name: createData.name,
      });

      if (existingExample) {
        throw new BadRequestException(
          `Example with name '${createData.name}' already exists`,
        );
      }

      return await this.crudService.create(
        ExampleEntity,
        createData as DeepPartial<ExampleEntity>,
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to create example",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update an existing example
   * PUT /examples/:id
   */
  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() updateData: UpdateExampleDto,
  ): Promise<ExampleEntity> {
    try {
      if (!id) {
        throw new BadRequestException("Example ID is required");
      }

      // Check if example exists
      const existingExample = await this.crudService.findById(
        ExampleEntity,
        id,
      );
      if (!existingExample) {
        throw new NotFoundException(`Example with ID ${id} not found`);
      }

      // If updating name, check for conflicts
      if (updateData.name && updateData.name !== existingExample.name) {
        const nameConflict = await this.crudService.findOne(ExampleEntity, {
          name: updateData.name,
        });
        if (nameConflict && nameConflict.id !== id) {
          throw new BadRequestException(
            `Example with name '${updateData.name}' already exists`,
          );
        }
      }

      const updatedExample = await this.crudService.update(
        ExampleEntity,
        id,
        updateData as DeepPartial<ExampleEntity>,
      );

      if (!updatedExample) {
        throw new HttpException(
          "Failed to update example",
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return updatedExample;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to update example",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Soft delete an example (sets deletedAt timestamp)
   * DELETE /examples/:id
   */
  @Delete(":id")
  async delete(@Param("id") id: string): Promise<{ message: string }> {
    try {
      if (!id) {
        throw new BadRequestException("Example ID is required");
      }

      // Check if example exists
      const existingExample = await this.crudService.findById(
        ExampleEntity,
        id,
      );
      if (!existingExample) {
        throw new NotFoundException(`Example with ID ${id} not found`);
      }

      await this.crudService.deleteById(ExampleEntity, id);

      return { message: `Example with ID ${id} has been soft deleted` };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to delete example",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get count of examples
   * GET /examples/count
   */
  @Get("meta/count")
  async count(@Query("name") name?: string): Promise<{ count: number }> {
    try {
      const whereConditions = name ? { name } : undefined;
      const count = await this.crudService.count(
        ExampleEntity,
        whereConditions,
      );
      return { count };
    } catch (error) {
      throw new HttpException(
        "Failed to count examples",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Restore a soft-deleted example
   * POST /examples/:id/restore
   */
  @Post(":id/restore")
  async restore(@Param("id") id: string): Promise<{ message: string }> {
    try {
      if (!id) {
        throw new BadRequestException("Example ID is required");
      }

      // Check if example is soft deleted
      const isSoftDeleted = await this.crudService.isSoftDeleted(
        ExampleEntity,
        id,
      );
      if (!isSoftDeleted) {
        throw new BadRequestException(
          `Example with ID ${id} is not deleted or does not exist`,
        );
      }

      await this.crudService.restore(ExampleEntity, id);

      return { message: `Example with ID ${id} has been restored` };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        "Failed to restore example",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

/**
 * DTO for creating a new example
 */
export type CreateExampleDto = {
  name: string;
  description?: string;
  metadata?: Record<string, any>;
};

/**
 * DTO for updating an existing example
 */
export type UpdateExampleDto = {
  name?: string;
  description?: string;
  metadata?: Record<string, any>;
};
