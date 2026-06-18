import { BadRequestException, Injectable } from '@nestjs/common';
import { ProductEligibilityRule } from '../database/entities';

type RuleCondition = {
  field: string;
  operator: string;
  value?: unknown;
  valueFrom?: string;
};

type RuleGroup = {
  all?: Array<RuleCondition | RuleGroup>;
  any?: Array<RuleCondition | RuleGroup>;
};

type RuleEvaluation = {
  ruleCode: string;
  ruleVersion: number;
  passed: boolean;
  score: number;
  reason: string;
};

const operators = new Set([
  'equals',
  'notEquals',
  'greaterThan',
  'greaterThanOrEqual',
  'lessThan',
  'lessThanOrEqual',
  'in',
  'notIn',
  'between',
  'contains',
  'exists',
  'regex',
]);

@Injectable()
export class RuleEngineService {
  validateRuleDefinition(definition: Record<string, unknown>) {
    if (!definition || typeof definition !== 'object') {
      throw new BadRequestException('Rule definition must be an object');
    }
    this.validateNode(definition as RuleGroup | RuleCondition);
    return true;
  }

  evaluateRules(rules: ProductEligibilityRule[], context: Record<string, unknown>) {
    const evaluations: RuleEvaluation[] = rules.map((rule) => {
      const passed = this.evaluateNode(rule.ruleDefinition as RuleGroup | RuleCondition, context);
      return {
        ruleCode: rule.ruleCode,
        ruleVersion: rule.version,
        passed,
        score: passed ? rule.score : 0,
        reason: passed ? `${rule.name} passed` : (rule.failureReason ?? `${rule.name} failed`),
      };
    });

    const passed = evaluations.every((evaluation) => evaluation.passed);
    const score = evaluations.reduce((sum, evaluation) => sum + evaluation.score, 0);

    return {
      passed,
      score,
      reason: passed
        ? 'All configured eligibility rules passed'
        : evaluations.filter((evaluation) => !evaluation.passed).map((evaluation) => evaluation.reason).join('; '),
      evaluations,
      inputSnapshot: this.redactSensitive(context),
      evaluatedAt: new Date().toISOString(),
    };
  }

  private validateNode(node: RuleGroup | RuleCondition) {
    if ('all' in node || 'any' in node) {
      const all = Array.isArray(node.all) ? node.all : [];
      const any = Array.isArray(node.any) ? node.any : [];
      if (!all.length && !any.length) {
        throw new BadRequestException('Rule group must contain all or any conditions');
      }
      [...all, ...any].forEach((child) => this.validateNode(child as RuleGroup | RuleCondition));
      return;
    }

    const condition = node as RuleCondition;
    if (!condition.field || !condition.operator) {
      throw new BadRequestException('Rule condition requires field and operator');
    }
    if (!operators.has(condition.operator)) {
      throw new BadRequestException(`Unsupported rule operator: ${condition.operator}`);
    }
    if (!/^[a-zA-Z0-9_.]+$/.test(condition.field)) {
      throw new BadRequestException(`Invalid rule field path: ${condition.field}`);
    }
    if (condition.valueFrom && !/^[a-zA-Z0-9_.]+$/.test(condition.valueFrom)) {
      throw new BadRequestException(`Invalid valueFrom path: ${condition.valueFrom}`);
    }
  }

  private evaluateNode(node: RuleGroup | RuleCondition, context: Record<string, unknown>): boolean {
    if ('all' in node && Array.isArray(node.all)) {
      return node.all.every((child) => this.evaluateNode(child as RuleGroup | RuleCondition, context));
    }
    if ('any' in node && Array.isArray(node.any)) {
      return node.any.some((child) => this.evaluateNode(child as RuleGroup | RuleCondition, context));
    }

    return this.evaluateCondition(node as RuleCondition, context);
  }

  private evaluateCondition(condition: RuleCondition, context: Record<string, unknown>): boolean {
    const actual = this.resolvePath(context, condition.field);
    const expected = condition.valueFrom ? this.resolvePath(context, condition.valueFrom) : condition.value;

    switch (condition.operator) {
      case 'equals':
        return actual === expected;
      case 'notEquals':
        return actual !== expected;
      case 'greaterThan':
        return Number(actual) > Number(expected);
      case 'greaterThanOrEqual':
        return Number(actual) >= Number(expected);
      case 'lessThan':
        return Number(actual) < Number(expected);
      case 'lessThanOrEqual':
        return Number(actual) <= Number(expected);
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      case 'between':
        return Array.isArray(expected) && expected.length === 2 && Number(actual) >= Number(expected[0]) && Number(actual) <= Number(expected[1]);
      case 'contains':
        return Array.isArray(actual) ? actual.includes(expected) : String(actual ?? '').includes(String(expected ?? ''));
      case 'exists':
        return actual !== undefined && actual !== null && actual !== '';
      case 'regex':
        return typeof expected === 'string' && new RegExp(expected).test(String(actual ?? ''));
      default:
        return false;
    }
  }

  private resolvePath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (current && typeof current === 'object' && segment in current) {
        return (current as Record<string, unknown>)[segment];
      }
      return undefined;
    }, source);
  }

  private redactSensitive(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.redactSensitive(item));
    }
    if (!value || typeof value !== 'object') {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => {
        if (/password|secret|token|aadhaar|accountNumber|credential/i.test(key)) {
          return [key, '[REDACTED]'];
        }
        return [key, this.redactSensitive(item)];
      }),
    );
  }
}
