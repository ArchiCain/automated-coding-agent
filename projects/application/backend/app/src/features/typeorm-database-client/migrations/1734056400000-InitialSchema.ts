import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Initial Schema Migration
 *
 * Creates the foundational database structure including:
 * - Required PostgreSQL extensions (uuid-ossp, vector)
 * - example_schema (owned by TypeORM)
 * - examples table
 *
 * Note:
 * - Keycloak manages its own schema (keycloak)
 * - Mastra manages its own schema (mastra)
 */
export class InitialSchema1734056400000 implements MigrationInterface {
    name = 'InitialSchema1734056400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create required extensions
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "vector"`);

        // Create TypeORM-managed schema
        await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS example_schema`);

        // Create examples table
        await queryRunner.query(`
            CREATE TABLE example_schema.examples (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name VARCHAR(255) NOT NULL,
                description TEXT,
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP WITH TIME ZONE
            )
        `);

        // Create indexes for better performance
        await queryRunner.query(`CREATE INDEX idx_examples_name ON example_schema.examples (name)`);
        await queryRunner.query(`CREATE INDEX idx_examples_created_at ON example_schema.examples (created_at)`);
        await queryRunner.query(`CREATE INDEX idx_examples_updated_at ON example_schema.examples (updated_at)`);
        await queryRunner.query(`CREATE INDEX idx_examples_deleted_at ON example_schema.examples (deleted_at)`);

        // Create partial index for active (non-deleted) records
        await queryRunner.query(`CREATE INDEX idx_examples_active ON example_schema.examples (id) WHERE deleted_at IS NULL`);

        // Create GIN index for JSONB metadata column
        await queryRunner.query(`CREATE INDEX idx_examples_metadata_gin ON example_schema.examples USING GIN (metadata)`);

        // Add table and column comments
        await queryRunner.query(`
            COMMENT ON TABLE example_schema.examples IS 'Example entities demonstrating the base entity pattern with UUID primary keys and soft delete functionality'
        `);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.id IS 'UUID primary key, auto-generated'`);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.name IS 'Name of the example entity, required field'`);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.description IS 'Optional text description'`);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.metadata IS 'JSON metadata for flexible data storage'`);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.created_at IS 'Timestamp when the record was created'`);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.updated_at IS 'Timestamp when the record was last updated'`);
        await queryRunner.query(`COMMENT ON COLUMN example_schema.examples.deleted_at IS 'Timestamp when the record was soft deleted (NULL if not deleted)'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop examples table and schema
        await queryRunner.query(`DROP TABLE IF EXISTS example_schema.examples CASCADE`);
        await queryRunner.query(`DROP SCHEMA IF EXISTS example_schema CASCADE`);

        // Note: Extensions are NOT dropped - they might be used by other schemas (keycloak, mastra)
    }
}
