import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserTheme1767287838000 implements MigrationInterface {
    name = 'AddUserTheme1767287838000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "example_schema"."user_theme" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" character varying NOT NULL,
                "theme" character varying(10) NOT NULL DEFAULT 'dark',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_user_theme_user_id" UNIQUE ("user_id"),
                CONSTRAINT "PK_user_theme_id" PRIMARY KEY ("id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "example_schema"."user_theme"`);
    }
}
