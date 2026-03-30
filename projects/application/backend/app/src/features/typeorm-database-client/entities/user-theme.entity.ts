import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_theme', { schema: 'example_schema' })
export class UserTheme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 10, default: 'dark' })
  theme: 'light' | 'dark';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
