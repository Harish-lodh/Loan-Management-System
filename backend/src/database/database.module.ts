import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, Loan, LoanApplication, Notification, Repayment, User } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST') ?? 'localhost',
        port: Number(config.get<string>('DB_PORT') ?? 3306),
        username: config.get<string>('DB_USERNAME') ?? 'root',
        password: config.get<string>('DB_PASSWORD') ?? '',
        database: config.get<string>('DB_DATABASE') ?? 'loan_management',
        entities: [User, LoanApplication, Loan, Repayment, Notification, AuditLog],
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
