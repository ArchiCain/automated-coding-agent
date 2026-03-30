import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  BaseEntity as TypeOrmBaseEntity,
} from "typeorm";

/**
 * Base entity class that provides common fields for all database entities.
 * Includes auto-generated UUID ID, timestamp fields, and soft delete functionality.
 * Hard deletes are prevented - only soft deletes are allowed.
 */
export abstract class BaseEntity extends TypeOrmBaseEntity {
  /**
   * Auto-generated UUID unique identifier
   */
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /**
   * Timestamp when the record was created
   */
  @CreateDateColumn({
    name: "created_at",
    type: "timestamp with time zone",
  })
  createdAt: Date;

  /**
   * Timestamp when the record was last updated
   */
  @UpdateDateColumn({
    name: "updated_at",
    type: "timestamp with time zone",
  })
  updatedAt: Date;

  /**
   * Timestamp when the record was soft deleted
   * This enables TypeORM's built-in soft delete functionality
   */
  @DeleteDateColumn({
    name: "deleted_at",
    type: "timestamp with time zone",
    nullable: true,
  })
  deletedAt?: Date;

  /**
   * Override the remove method to prevent hard deletes
   * Use softRemove() instead for soft deletion
   */
  remove(): Promise<this> {
    throw new Error(
      "Hard deletes are not allowed. Use softRemove() for soft deletion or manager.softDelete() for repository operations.",
    );
  }

  /**
   * Override the delete method to prevent hard deletes
   * This method is called by repository.delete()
   */
  static delete(): Promise<any> {
    throw new Error(
      "Hard deletes are not allowed. Use softDelete() method instead.",
    );
  }

  /**
   * Check if the entity is soft deleted
   */
  get isDeleted(): boolean {
    return this.deletedAt !== null && this.deletedAt !== undefined;
  }

  /**
   * Get the deletion timestamp if the entity is deleted
   */
  get deletionDate(): Date | null {
    return this.deletedAt || null;
  }
}
