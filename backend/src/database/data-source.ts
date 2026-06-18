import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { AuditLog, Loan, LoanApplication, Notification, Repayment, User } from './entities';

config();

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'loan_management',
  entities: [User, LoanApplication, Loan, Repayment, Notification, AuditLog],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
});
