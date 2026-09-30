import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { DATABASE_ENTITIES } from './entities';

config(process.env.ENV_FILE ? { path: process.env.ENV_FILE } : undefined);

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'loan_management',
  entities: DATABASE_ENTITIES,
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
