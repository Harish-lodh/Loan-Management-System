import { ForbiddenException } from '@nestjs/common';
import { Role } from '../database/entities';
import { FeeType, InterestCalculationMethod, InterestType, ProductType, RepaymentFrequency, TenureUnit } from '../database/entities/enums';
import { MasterDataService } from './master-data.service';

const scopedUser = {
  id: 'user-1',
  name: 'Scoped Admin',
  email: 'admin@org1.test',
  phone: '9999999999',
  organizationId: 'org-1',
  role: Role.ADMIN,
};

function serviceWith(overrides: Record<string, unknown> = {}) {
  const organizationsRepository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const productsRepository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const productVersionsRepository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const fieldsRepository = { find: jest.fn(), save: jest.fn(), create: jest.fn() };
  const rulesRepository = { find: jest.fn(), count: jest.fn(), save: jest.fn(), create: jest.fn() };
  const workflowDefinitionsRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const workflowStepsRepository = { find: jest.fn(), save: jest.fn(), create: jest.fn() };
  const partnersRepository = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn() };
  const partnerProductsRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() };
  const providersRepository = { find: jest.fn(), save: jest.fn(), create: jest.fn() };
  const applicationsRepository = { count: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLogService = { create: jest.fn() };
  const ruleEngine = { validateRuleDefinition: jest.fn() };

  const dependencies = {
    organizationsRepository,
    productsRepository,
    productVersionsRepository,
    fieldsRepository,
    rulesRepository,
    workflowDefinitionsRepository,
    workflowStepsRepository,
    partnersRepository,
    partnerProductsRepository,
    providersRepository,
    applicationsRepository,
    dataSource,
    auditLogService,
    ruleEngine,
    ...overrides,
  };

  return {
    service: new MasterDataService(
      dependencies.organizationsRepository as never,
      dependencies.productsRepository as never,
      dependencies.productVersionsRepository as never,
      dependencies.fieldsRepository as never,
      dependencies.rulesRepository as never,
      dependencies.workflowDefinitionsRepository as never,
      dependencies.workflowStepsRepository as never,
      dependencies.partnersRepository as never,
      dependencies.partnerProductsRepository as never,
      dependencies.providersRepository as never,
      dependencies.applicationsRepository as never,
      dependencies.dataSource as never,
      dependencies.auditLogService as never,
      dependencies.ruleEngine as never,
    ),
    dependencies,
  };
}

function createProductDto(organizationId: string) {
  return {
    organizationId,
    productCode: 'personal',
    name: 'Personal Loan',
    productType: ProductType.PERSONAL_LOAN,
    minimumLoanAmount: 1000,
    maximumLoanAmount: 100000,
    minimumTenure: 3,
    maximumTenure: 24,
    tenureUnit: TenureUnit.MONTHS,
    repaymentFrequency: RepaymentFrequency.MONTHLY,
    interestType: InterestType.FIXED,
    interestCalculationMethod: InterestCalculationMethod.REDUCING_BALANCE,
    minimumInterestRate: 10,
    maximumInterestRate: 20,
    defaultInterestRate: 12,
    processingFeeType: FeeType.PERCENTAGE,
    processingFeeValue: 1,
  };
}

describe('MasterDataService organization scope', () => {
  it('rejects creating a product for another organization', async () => {
    const { service } = serviceWith();

    await expect(service.createProduct(createProductDto('org-2'), scopedUser)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('scopes product lists to the authenticated organization', async () => {
    const { service, dependencies } = serviceWith();
    dependencies.productsRepository.find.mockResolvedValue([]);

    await service.listProducts(scopedUser);

    expect(dependencies.productsRepository.find).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
      order: { createdAt: 'DESC' },
    });
  });
});
