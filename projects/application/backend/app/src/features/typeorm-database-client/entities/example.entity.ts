import { Entity, Column } from "typeorm";
import { BaseEntity } from "./base.entity";

/**
 * Example entity demonstrating how to use the BaseEntity class.
 * Automatically includes soft delete functionality through BaseEntity.
 * This can be removed in production - it's just for reference.
 */
@Entity("examples", { schema: "example_schema" })
export class ExampleEntity extends BaseEntity {
  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;
}
