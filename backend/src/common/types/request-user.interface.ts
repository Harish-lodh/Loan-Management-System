import { Role } from '../../database/entities/enums';

export interface RequestUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string | null;
  occupation?: string | null;
  annualIncome?: number | null;
  role: Role;
}
